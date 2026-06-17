# Unsafe HTML

This file verifies that preview rendering sanitizes unsafe HTML.

## Safe-ish Inline HTML

<span title="hello">Span text</span>

<kbd>Ctrl</kbd> + <kbd>S</kbd>

## Details

<details>
<summary>Summary text</summary>

Details body.

</details>

## Unsafe Script

The following should not execute:

<script>alert("blocked")</script>

## Unsafe Attributes

<img src="x" onerror="alert('blocked')" />

<a href="javascript:alert('blocked')">Bad link</a>

## Iframe

<iframe src="https://example.com"></iframe>

## Style

<style>
body {
  background: red;
}
</style>
