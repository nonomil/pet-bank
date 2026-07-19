from generate_minecraft_vocab_narration import manifest_status


assert manifest_status(10, 10, []) == "complete"
assert manifest_status(9, 10, []) == "partial"
assert manifest_status(10, 10, [], phase="in-progress") == "in-progress"
assert manifest_status(10, 10, [{"cardId": "card-1"}]) == "partial"

print("minecraft vocab narration state: PASS")
