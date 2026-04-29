---
test_id: 012-clean-prompt-no-findings
expected_rules:
forbidden_rules: PR001,PR004,PR006,PR007,PR008,PR-INJ01,PR-INJ02,PR-INJ03
language: en
---
Classify each row of the attached CSV (columns: id, text, lang) into exactly one of {bug, feature_request, praise, other}. Return a CSV with two columns: id, label. Do not change any other column.
