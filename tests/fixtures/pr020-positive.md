---
test_id: pr020-positive
expected_rules: PR020
forbidden_rules:
language: en
args: --format=json --no-config --rules=PR020 -
expect_exit: 0
---
Classify each review as positive or negative.

Example 1:
Input: I love this product
Output: positive

Example 2:
Output: negative
