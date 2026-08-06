import tar from "tar-stream";
import { PassThrough } from "node:stream";
import { performance } from "node:perf_hooks";
import { parseAssertionMetrics } from "./assertions.js";
export class DockerSandboxRunner {
    docker;
    images;
    ociRuntime;
    constructor(docker, images, ociRuntime) {
        this.docker = docker;
        this.images = images;
        this.ociRuntime = ociRuntime;
    }
    async execute(request) {
        const runtime = this.runtimeConfig(request.runtime);
        const memoryBytes = request.limits.memoryMb * 1024 * 1024;
        const workspaceMb = Math.min(32, Math.max(4, Math.ceil((Buffer.byteLength(request.source) +
            Buffer.byteLength(request.testSource)) /
            1024 /
            1024) + 2));
        const hostConfig = {
            AutoRemove: false,
            NetworkMode: "none",
            ReadonlyRootfs: true,
            CapDrop: ["ALL"],
            SecurityOpt: ["no-new-privileges:true"],
            Memory: memoryBytes,
            MemorySwap: memoryBytes,
            NanoCpus: Math.floor((request.limits.cpuMillis / 1_000) * 1_000_000_000),
            PidsLimit: request.limits.pids,
            OomKillDisable: false,
            Init: true,
            Tmpfs: {
                "/workspace": `rw,noexec,nosuid,nodev,size=${workspaceMb}m,uid=65532,gid=65532,mode=0700`,
                "/tmp": "rw,noexec,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=0700",
            },
            Ulimits: [
                { Name: "nofile", Soft: 64, Hard: 64 },
                { Name: "nproc", Soft: request.limits.pids, Hard: request.limits.pids },
                { Name: "core", Soft: 0, Hard: 0 },
                { Name: "fsize", Soft: 8 * 1024 * 1024, Hard: 8 * 1024 * 1024 },
            ],
        };
        if (this.ociRuntime)
            Object.assign(hostConfig, { Runtime: this.ociRuntime });
        const container = await this.docker.createContainer({
            Image: runtime.image,
            Cmd: runtime.command,
            WorkingDir: "/workspace",
            User: "65532:65532",
            Env: ["HOME=/tmp", "PYTHONDONTWRITEBYTECODE=1", "NODE_NO_WARNINGS=1"],
            AttachStdout: true,
            AttachStderr: true,
            OpenStdin: false,
            Tty: false,
            StopSignal: "SIGKILL",
            Labels: {
                "agent-forum.run-id": request.runId,
                "agent-forum.ephemeral": "true",
            },
            HostConfig: hostConfig,
        });
        const stdout = new PassThrough();
        const stderr = new PassThrough();
        let stdoutText = "";
        let stderrText = "";
        const append = (current, chunk) => (current + chunk.toString("utf8")).slice(0, request.limits.outputBytes);
        stdout.on("data", (chunk) => {
            stdoutText = append(stdoutText, chunk);
        });
        stderr.on("data", (chunk) => {
            stderrText = append(stderrText, chunk);
        });
        let timedOut = false;
        let peakMemoryBytes = 0;
        let statsStream;
        const start = performance.now();
        try {
            await container.putArchive(await this.sourceArchive(runtime, request.source, request.testSource), { path: "/workspace" });
            const stream = await container.attach({
                stream: true,
                stdout: true,
                stderr: true,
            });
            this.docker.modem.demuxStream(stream, stdout, stderr);
            await container.start();
            statsStream = (await container.stats({ stream: true }));
            let statsBuffer = "";
            statsStream.on("data", (chunk) => {
                statsBuffer += chunk.toString("utf8");
                const lines = statsBuffer.split("\n");
                statsBuffer = lines.pop() ?? "";
                for (const line of lines) {
                    try {
                        const stat = JSON.parse(line);
                        peakMemoryBytes = Math.max(peakMemoryBytes, stat.memory_stats?.usage ?? 0);
                    }
                    catch {
                        /* Docker stats may split JSON frames; memory remains best-effort. */
                    }
                }
            });
            const wait = container.wait();
            const timeout = new Promise((_resolve, reject) => {
                const timer = setTimeout(() => reject(new Error("SANDBOX_TIMEOUT")), request.limits.timeoutMs);
                timer.unref();
            });
            try {
                await Promise.race([wait, timeout]);
            }
            catch (error) {
                if (error instanceof Error && error.message === "SANDBOX_TIMEOUT") {
                    timedOut = true;
                    await container.kill({ signal: "SIGKILL" }).catch(() => undefined);
                    await container.wait().catch(() => undefined);
                }
                else {
                    throw error;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
            const inspection = await container.inspect();
            const exitCode = inspection.State.ExitCode;
            const assertions = parseAssertionMetrics(request.runtime, stdoutText, stderrText);
            const status = timedOut
                ? "timeout"
                : exitCode === 0 && assertions.failed === 0
                    ? "passed"
                    : "failed";
            return {
                runId: request.runId,
                status,
                exitCode: timedOut ? null : exitCode,
                durationMs: performance.now() - start,
                peakMemoryBytes,
                stdout: stdoutText,
                stderr: stderrText,
                assertionsPassed: assertions.passed,
                assertionsFailed: assertions.failed,
            };
        }
        catch (error) {
            return {
                runId: request.runId,
                status: "internal_error",
                exitCode: null,
                durationMs: performance.now() - start,
                peakMemoryBytes,
                stdout: stdoutText,
                stderr: `${stderrText}\n${error instanceof Error ? error.message : "Unknown runner error"}`
                    .trim()
                    .slice(0, request.limits.outputBytes),
                assertionsPassed: 0,
                assertionsFailed: 0,
            };
        }
        finally {
            statsStream?.destroy();
            stdout.destroy();
            stderr.destroy();
            await container.remove({ force: true, v: true }).catch(() => undefined);
        }
    }
    runtimeConfig(runtime) {
        if (runtime === "python") {
            return {
                image: this.images.python,
                sourceName: "solution.py",
                testName: "test_solution.py",
                command: [
                    "python",
                    "-I",
                    "-B",
                    "-m",
                    "unittest",
                    "-v",
                    "test_solution.py",
                ],
            };
        }
        return {
            image: this.images.javascript,
            sourceName: "solution.mjs",
            testName: "test_solution.mjs",
            command: [
                "node",
                "--disable-proto=delete",
                "--frozen-intrinsics",
                "--test",
                "test_solution.mjs",
            ],
        };
    }
    async sourceArchive(runtime, source, tests) {
        const pack = tar.pack();
        const add = (name, content) => new Promise((resolve, reject) => {
            pack.entry({
                name,
                mode: 0o400,
                uid: 65532,
                gid: 65532,
                size: Buffer.byteLength(content),
            }, content, (error) => (error ? reject(error) : resolve()));
        });
        await add(runtime.sourceName, source);
        await add(runtime.testName, tests);
        pack.finalize();
        return pack;
    }
}
//# sourceMappingURL=runner.js.map