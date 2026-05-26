import json
from typing import AsyncIterator
from tools.types import SubAgentResult


async def parse_agent_events(agent_stream: AsyncIterator) -> AsyncIterator[str]:
    """Parse agent streaming events and yield formatted JSON strings"""
    emitted_tools = set()
    emitted_sub_tools = set()
    result = None

    try:
        async for event in agent_stream:
            if "event" in event and isinstance(event["event"], dict):
                inner_event = event["event"]

                if "contentBlockDelta" in inner_event:
                    delta = inner_event["contentBlockDelta"].get("delta", {})
                    if "text" in delta:
                        yield json.dumps({
                            "type": "text",
                            "content": delta["text"]
                        }) + "\n"

                if "contentBlockStart" in inner_event:
                    start = inner_event["contentBlockStart"].get("start", {})
                    if "toolUse" in start:
                        tool_use = start["toolUse"]
                        tool_id = tool_use.get("toolUseId")
                        tool_name = tool_use.get("name")

                        if tool_id and tool_id not in emitted_tools:
                            emitted_tools.add(tool_id)
                            yield json.dumps({
                                "type": "tool_start",
                                "name": tool_name,
                                "toolUseId": tool_id
                            }) + "\n"

            if "message" in event:
                message = event["message"]
                if message.get("role") == "assistant" and "content" in message:
                    for content_block in message["content"]:
                        if "toolUse" in content_block:
                            tool_use = content_block["toolUse"]
                            tool_id = tool_use.get("toolUseId")
                            tool_name = tool_use.get("name")
                            tool_input = tool_use.get("input", {})

                            yield json.dumps({
                                "type": "tool",
                                "name": tool_name,
                                "toolUseId": tool_id,
                                "input": tool_input
                            }) + "\n"

            if "tool_stream_event" in event:
                tool_stream = event["tool_stream_event"]
                data = tool_stream.get("data")

                if isinstance(data, SubAgentResult):
                    sub_event = data.event
                    agent_name = data.agent.name

                    if "event" in sub_event and isinstance(sub_event["event"], dict):
                        sub_inner = sub_event["event"]
                        if "contentBlockDelta" in sub_inner:
                            delta = sub_inner["contentBlockDelta"].get("delta", {})
                            if "text" in delta:
                                yield json.dumps({
                                    "type": "sub_text",
                                    "agent": agent_name,
                                    "content": delta["text"]
                                }) + "\n"

                    if "message" in sub_event:
                        message = sub_event["message"]
                        if message.get("role") == "assistant" and "content" in message:
                            for content_block in message["content"]:
                                if "toolUse" in content_block:
                                    tool_use = content_block["toolUse"]
                                    tool_id = tool_use.get("toolUseId")
                                    tool_name = tool_use.get("name")
                                    tool_input = tool_use.get("input", {})

                                    if tool_id and tool_id not in emitted_sub_tools:
                                        emitted_sub_tools.add(tool_id)
                                        yield json.dumps({
                                            "type": "sub_tool",
                                            "agent": agent_name,
                                            "name": tool_name,
                                            "toolUseId": tool_id,
                                            "input": tool_input
                                        }) + "\n"

            if "result" in event:
                result = event["result"]

        # Handle result - check for interrupts
        if result:
            if hasattr(result, "stop_reason") and result.stop_reason == "interrupt":
                # Emit interrupt events for frontend to display confirmation UI
                for interrupt in result.interrupts:
                    yield json.dumps({
                        "type": "interrupt",
                        "interrupt_id": interrupt.id,
                        "name": interrupt.name,
                        "reason": interrupt.reason,
                    }) + "\n"
            else:
                yield json.dumps({"type": "result", "response": str(result)}) + "\n"

    except Exception as e:
        yield json.dumps({"type": "error", "error": str(e)}) + "\n"
