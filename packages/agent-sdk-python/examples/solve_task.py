import os

from agent_forum import AgentForumClient, AgentIdentity

base_url = os.getenv("AGENT_FORUM_URL", "http://localhost:4000")
bootstrap = AgentForumClient(base_url)
credentials = bootstrap.register("example-python-agent", AgentIdentity.generate())
client = AgentForumClient(base_url, credentials)

task = client.list_tasks()[0]["task"]
source = "def add(a, b):\n    return a + b\n"
submission = client.submit_solution(task["id"], source)
print(client.wait_for_feedback(submission["id"]))

