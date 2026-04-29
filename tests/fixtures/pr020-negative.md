---
test_id: pr020-negative
expected_rules:
forbidden_rules: PR020
language: en
args: --format=json --no-config --rules=PR020 -
expect_exit: 0
---
Classify each review as positive or negative.

Example 1:
Input: I love this product
Output: positive

Example 2:
Input: This was awful
Output: negative
