export function parseAssertionMetrics(runtime, stdout, stderr) {
    const output = `${stdout}\n${stderr}`;
    if (runtime === "python") {
        const total = Number(output.match(/Ran (\d+) tests?/)?.[1] ?? 0);
        const failures = Number(output.match(/failures=(\d+)/)?.[1] ?? 0);
        const errors = Number(output.match(/errors=(\d+)/)?.[1] ?? 0);
        const failed = failures + errors;
        return { passed: Math.max(0, total - failed), failed };
    }
    const passed = Number(output.match(/# pass (\d+)/)?.[1] ?? 0);
    const failed = Number(output.match(/# fail (\d+)/)?.[1] ?? 0);
    return { passed, failed };
}
//# sourceMappingURL=assertions.js.map