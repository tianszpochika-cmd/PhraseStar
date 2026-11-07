#!/usr/bin/env python3
"""Optional operator-supplied private IPv4 subnet for one owned temporary bridge.

Default (no CIDR) leaves Docker default IPAM unchanged. A supplied value must
be a canonical RFC1918 IPv4 network with prefix length 24 through 29, must
sit on the network address, and must not overlap any existing Docker IPAM
IPv4 range. This module does not create, delete, or edit Docker objects.
Importing it does not inspect the daemon. A direct run without arguments
prints a usage line and returns.
"""
from __future__ import annotations

import json
import re
import sys
from typing import Any

USAGE_REASON = "call-validateOwnedBridgeSubnet"
CIDR_RE = re.compile(r"^([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/([0-9]{1,2})$")
OCTET_RE = re.compile(r"^(?:0|[1-9][0-9]{0,2})$")
PREFIX_RE = re.compile(r"^(?:[1-9][0-9]?)$")
PRIVATE_BLOCKS = (
    (int("0a000000", 16), 8),   # 10.0.0.0/8
    (int("ac100000", 16), 12),  # 172.16.0.0/12
    (int("c0a80000", 16), 16),  # 192.168.0.0/16
)
MIN_PREFIX = 24
MAX_PREFIX = 29
CATEGORIES = (
    "unset",
    "ok",
    "supplied-ready",
    "supplied-ok",
    "create-ok",
    "invalid-cidr",
    "overlap",
    "address-pools-exhausted",
    "create-failed",
    "ipam-inspect",
)


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n")


def usage() -> int:
    emit({
        "ok": False,
        "reason": USAGE_REASON,
        "category": "unset",
        "cidr": None,
        "overlapWith": None,
    })
    return 0


def ip_to_int(octets: tuple[int, int, int, int]) -> int:
    return (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]


def int_to_ip(value: int) -> str:
    return ".".join(str((value >> shift) & 255) for shift in (24, 16, 8, 0))


def mask_of(prefix: int) -> int:
    if prefix <= 0:
        return 0
    return (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF


def network_range(network: int, prefix: int) -> tuple[int, int]:
    mask = mask_of(prefix)
    start = network & mask
    end = start | (~mask & 0xFFFFFFFF)
    return start, end


def wholly_private(network: int, prefix: int) -> bool:
    start, end = network_range(network, prefix)
    for block, block_prefix in PRIVATE_BLOCKS:
        if prefix < block_prefix:
            continue
        block_start, block_end = network_range(block, block_prefix)
        if start >= block_start and end <= block_end:
            return True
    return False


def parse_existing_cidr(text: str) -> tuple[int, int] | None:
    if not isinstance(text, str) or ":" in text:
        return None
    match = CIDR_RE.fullmatch(text.strip())
    if not match:
        return None
    try:
        octets = tuple(int(match.group(index)) for index in range(1, 5))
        prefix = int(match.group(5))
    except ValueError:
        return None
    if any(part > 255 for part in octets) or prefix < 0 or prefix > 32:
        return None
    start, end = network_range(ip_to_int(octets), prefix)
    return start, end


def canonical_private_cidr(text: str) -> str | None:
    if not isinstance(text, str) or text == "":
        return None
    if any(ch.isspace() for ch in text) or ":" in text:
        return None
    match = CIDR_RE.fullmatch(text)
    if not match:
        return None
    parts = [match.group(index) for index in range(1, 5)]
    prefix_text = match.group(5)
    if any(not OCTET_RE.fullmatch(part) for part in parts):
        return None
    if not PREFIX_RE.fullmatch(prefix_text):
        return None
    octets = tuple(int(part) for part in parts)
    prefix = int(prefix_text)
    if any(part > 255 for part in octets):
        return None
    if prefix < MIN_PREFIX or prefix > MAX_PREFIX:
        return None
    network = ip_to_int(octets)
    start, _end = network_range(network, prefix)
    if start != network:
        return None
    if not wholly_private(network, prefix):
        return None
    return f"{int_to_ip(network)}/{prefix}"


def parse_optional(text: str | None) -> dict[str, Any]:
    if text is None or text == "":
        return {"ok": True, "category": "unset", "cidr": None, "overlapWith": None, "reason": None}
    cidr = canonical_private_cidr(text)
    if cidr is None:
        return {
            "ok": False,
            "category": "invalid-cidr",
            "cidr": None,
            "overlapWith": None,
            "reason": "subnet-invalid",
        }
    return {"ok": True, "category": "ok", "cidr": cidr, "overlapWith": None, "reason": None}


def existing_ipv4_ranges(payload: Any) -> tuple[list[tuple[str, int, int]] | None, str]:
    if payload is None:
        return None, "ipam-inspect"
    if isinstance(payload, list):
        networks = payload
    elif isinstance(payload, dict):
        networks = [payload]
    else:
        return None, "ipam-inspect"
    ranges: list[tuple[str, int, int]] = []
    seen: set[tuple[int, int]] = set()
    for network in networks:
        if not isinstance(network, dict):
            return None, "ipam-inspect"
        ipam = network.get("IPAM")
        if ipam is None:
            continue
        if not isinstance(ipam, dict):
            return None, "ipam-inspect"
        configs = ipam.get("Config")
        if configs is None:
            continue
        if not isinstance(configs, list):
            return None, "ipam-inspect"
        for item in configs:
            if not isinstance(item, dict):
                return None, "ipam-inspect"
            subnet = item.get("Subnet")
            if subnet is None:
                continue
            if not isinstance(subnet, str):
                return None, "ipam-inspect"
            if ":" in subnet:
                continue
            parsed = parse_existing_cidr(subnet)
            if parsed is None:
                return None, "ipam-inspect"
            if parsed in seen:
                continue
            seen.add(parsed)
            start, end = parsed
            span = end - start + 1
            prefix = 32
            width = span
            while width > 1:
                if width % 2 != 0:
                    return None, "ipam-inspect"
                width //= 2
                prefix -= 1
            label = f"{int_to_ip(start)}/{prefix}"
            ranges.append((label, start, end))
    return ranges, "ok"


def first_overlap(cidr: str, ranges: list[tuple[str, int, int]]) -> str | None:
    parsed = parse_existing_cidr(cidr)
    if parsed is None:
        return None
    start, end = parsed
    for label, other_start, other_end in ranges:
        if start <= other_end and other_start <= end:
            return label
    return None


def against_ipam(cidr_text: str, payload: Any) -> dict[str, Any]:
    parsed = parse_optional(cidr_text)
    if not parsed["ok"] or parsed["cidr"] is None:
        return parsed
    ranges, status = existing_ipv4_ranges(payload)
    if ranges is None:
        return {
            "ok": False,
            "category": "ipam-inspect",
            "cidr": parsed["cidr"],
            "overlapWith": None,
            "reason": "ipam-inspect",
        }
    overlap = first_overlap(parsed["cidr"], ranges)
    if overlap is not None:
        return {
            "ok": False,
            "category": "overlap",
            "cidr": parsed["cidr"],
            "overlapWith": overlap,
            "reason": "subnet-overlap",
        }
    return {
        "ok": True,
        "category": "ok",
        "cidr": parsed["cidr"],
        "overlapWith": None,
        "reason": None,
    }


def confirm_created(cidr_text: str, payload: Any) -> dict[str, Any]:
    parsed = parse_optional(cidr_text)
    if not parsed["ok"] or parsed["cidr"] is None:
        return parsed
    networks = payload if isinstance(payload, list) else [payload]
    if not networks or not all(isinstance(item, dict) for item in networks):
        return {
            "ok": False,
            "category": "create-failed",
            "cidr": parsed["cidr"],
            "overlapWith": None,
            "reason": "mysql-network",
        }
    found: list[str] = []
    for network in networks:
        ipam = network.get("IPAM") if isinstance(network, dict) else None
        configs = ipam.get("Config") if isinstance(ipam, dict) else None
        if not isinstance(configs, list) or not configs:
            return {
                "ok": False,
                "category": "create-failed",
                "cidr": parsed["cidr"],
                "overlapWith": None,
                "reason": "mysql-network",
            }
        for item in configs:
            if not isinstance(item, dict):
                return {
                    "ok": False,
                    "category": "create-failed",
                    "cidr": parsed["cidr"],
                    "overlapWith": None,
                    "reason": "mysql-network",
                }
            subnet = item.get("Subnet")
            if not isinstance(subnet, str):
                return {
                    "ok": False,
                    "category": "create-failed",
                    "cidr": parsed["cidr"],
                    "overlapWith": None,
                    "reason": "mysql-network",
                }
            if ":" in subnet:
                return {
                    "ok": False,
                    "category": "create-failed",
                    "cidr": parsed["cidr"],
                    "overlapWith": None,
                    "reason": "mysql-network",
                }
            existing = parse_existing_cidr(subnet)
            expected = parse_existing_cidr(parsed["cidr"])
            if existing is None or expected is None or existing != expected:
                return {
                    "ok": False,
                    "category": "create-failed",
                    "cidr": parsed["cidr"],
                    "overlapWith": None,
                    "reason": "mysql-network",
                }
            found.append(parsed["cidr"])
    if found != [parsed["cidr"]]:
        return {
            "ok": False,
            "category": "create-failed",
            "cidr": parsed["cidr"],
            "overlapWith": None,
            "reason": "mysql-network",
        }
    return {
        "ok": True,
        "category": "supplied-ok",
        "cidr": parsed["cidr"],
        "overlapWith": None,
        "reason": None,
    }


def classify_stderr(text: str) -> dict[str, Any]:
    blob = text.lower() if isinstance(text, str) else ""
    category = "create-failed"
    if "fully subnetted" in blob or "address pools" in blob:
        category = "address-pools-exhausted"
    elif "overlap" in blob:
        category = "overlap"
    elif "invalid cidr" in blob or "invalid subnet" in blob:
        category = "invalid-cidr"
    return {
        "ok": False,
        "category": category,
        "cidr": None,
        "overlapWith": None,
        "reason": "mysql-network",
        "daemonCategory": category,
    }


def load_json_stdin() -> Any:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("empty")
    return json.loads(raw)


def self_check() -> bool:
    cases: list[tuple[str, Any]] = []

    empty = parse_optional("")
    cases.append(("empty-unset", empty["category"] == "unset" and empty["ok"] is True and empty["cidr"] is None))

    hint = parse_optional("10.254.254.0/28")
    cases.append(("hint-canonical", hint["ok"] is True and hint["cidr"] == "10.254.254.0/28"))

    cases.append(("host-bits", parse_optional("10.254.254.1/28")["category"] == "invalid-cidr"))
    cases.append(("public", parse_optional("8.8.8.0/24")["category"] == "invalid-cidr"))
    cases.append(("ipv6", parse_optional("fd00::/64")["category"] == "invalid-cidr"))
    cases.append(("mask", parse_optional("10.254.254.0/99")["category"] == "invalid-cidr"))
    cases.append(("text", parse_optional("not-a-cidr")["category"] == "invalid-cidr"))
    cases.append(("space", parse_optional(" 10.254.254.0/28")["category"] == "invalid-cidr"))
    cases.append(("leading-zero", parse_optional("010.254.254.0/28")["category"] == "invalid-cidr"))
    cases.append(("wide", parse_optional("10.0.0.0/8")["category"] == "invalid-cidr"))
    cases.append(("tiny", parse_optional("10.254.254.0/32")["category"] == "invalid-cidr"))
    cases.append(("cgnat", parse_optional("100.64.0.0/24")["category"] == "invalid-cidr"))
    cases.append(("loopback", parse_optional("127.0.0.0/24")["category"] == "invalid-cidr"))
    cases.append(("link-local", parse_optional("169.254.0.0/16")["category"] == "invalid-cidr"))
    cases.append(("rfc1918-172", parse_optional("172.16.1.0/24")["cidr"] == "172.16.1.0/24"))
    cases.append(("rfc1918-192", parse_optional("192.168.50.0/28")["cidr"] == "192.168.50.0/28"))
    cases.append(("outside-172", parse_optional("172.15.0.0/24")["category"] == "invalid-cidr"))

    inspect = [
        {"Name": "bridge", "IPAM": {"Config": [{"Subnet": "172.17.0.0/16", "Gateway": "172.17.0.1"}]}},
        {"Name": "dockerdesktop", "IPAM": {"Config": [{"Subnet": "192.168.65.0/24"}]}},
        {"Name": "other", "IPAM": {"Config": [{"Subnet": "10.0.0.0/24"}, {"Subnet": "fd00:dead::/64"}]}},
    ]
    for index in range(35):
        inspect.append({
            "Name": f"filled-{index}",
            "IPAM": {"Config": [{"Subnet": f"172.18.{index}.0/24"}]},
        })
    free = against_ipam("10.254.254.0/28", inspect)
    cases.append(("hint-free-among-38", free["ok"] is True and free["cidr"] == "10.254.254.0/28"))

    hit = against_ipam("10.254.254.0/28", [{"IPAM": {"Config": [{"Subnet": "10.254.254.0/24"}]}}])
    cases.append(("overlap-parent", hit["category"] == "overlap" and hit["overlapWith"] == "10.254.254.0/24"))

    sibling = against_ipam("10.254.254.0/28", [{"IPAM": {"Config": [{"Subnet": "10.254.254.16/28"}]}}])
    cases.append(("adjacent-ok", sibling["ok"] is True))

    contained = against_ipam("10.0.0.0/24", [{"IPAM": {"Config": [{"Subnet": "10.0.0.128/25"}]}}])
    cases.append(("overlap-child", contained["category"] == "overlap"))

    defaulted = against_ipam("", inspect)
    cases.append(("against-empty", defaulted["category"] == "unset"))

    bad_ipam = against_ipam("10.254.254.0/28", {"IPAM": {"Config": [{"Subnet": "not-a-cidr"}]}})
    cases.append(("ipam-unparsed", bad_ipam["category"] == "ipam-inspect"))

    created = confirm_created("10.254.254.0/28", [{
        "IPAM": {"Config": [{"Subnet": "10.254.254.0/28", "Gateway": "10.254.254.1"}]},
    }])
    cases.append(("confirm-ok", created["ok"] is True and created["category"] == "supplied-ok"))

    wrong = confirm_created("10.254.254.0/28", [{"IPAM": {"Config": [{"Subnet": "10.254.253.0/28"}]}}])
    cases.append(("confirm-mismatch", wrong["ok"] is False))

    exhausted = classify_stderr("Error response from daemon: all predefined address pools have been fully subnetted")
    cases.append(("classify-exhausted", exhausted["category"] == "address-pools-exhausted"))
    overlap_daemon = classify_stderr("Error response from daemon: Pool overlaps with other one on this address space")
    cases.append(("classify-overlap", overlap_daemon["category"] == "overlap"))
    invalid_daemon = classify_stderr("Error response from daemon: invalid CIDR address: 10.1.2.3/99")
    cases.append(("classify-invalid", invalid_daemon["category"] == "invalid-cidr"))
    other_daemon = classify_stderr("permission denied talking to daemon")
    cases.append(("classify-other", other_daemon["category"] == "create-failed" and "permission" not in json.dumps(other_daemon)))

    failed = [name for name, ok in cases if not ok]
    emit({
        "ok": not failed,
        "reason": "self-check" if not failed else "self-check-failed",
        "category": "ok" if not failed else "invalid-cidr",
        "failed": failed,
        "checked": len(cases),
    })
    return not failed


def main(argv: list[str]) -> int:
    if len(argv) == 1:
        return usage()
    command = argv[1]
    if command == "--self-check":
        if len(argv) != 2:
            return usage() or 2
        return 0 if self_check() else 1
    if command == "--canonical":
        if len(argv) != 3:
            emit(parse_optional("not-a-cidr"))
            return 2
        result = parse_optional(argv[2])
        emit(result)
        return 0 if result["ok"] else 2
    if command == "--against-ipam":
        if len(argv) != 3:
            emit({"ok": False, "category": "ipam-inspect", "cidr": None, "overlapWith": None, "reason": "ipam-inspect"})
            return 2
        try:
            payload = load_json_stdin()
        except Exception:
            emit({"ok": False, "category": "ipam-inspect", "cidr": None, "overlapWith": None, "reason": "ipam-inspect"})
            return 2
        result = against_ipam(argv[2], payload)
        emit(result)
        if result["category"] == "overlap":
            return 1
        return 0 if result["ok"] else 2
    if command == "--confirm-created":
        if len(argv) != 3:
            emit({"ok": False, "category": "create-failed", "cidr": None, "overlapWith": None, "reason": "mysql-network"})
            return 2
        try:
            payload = load_json_stdin()
        except Exception:
            emit({"ok": False, "category": "create-failed", "cidr": None, "overlapWith": None, "reason": "mysql-network"})
            return 2
        result = confirm_created(argv[2], payload)
        emit(result)
        return 0 if result["ok"] else 1
    if command == "--classify-stderr":
        if len(argv) != 3:
            emit(classify_stderr(""))
            return 2
        path = argv[2]
        try:
            if path == "-":
                text = sys.stdin.read()
            else:
                with open(path, "r", encoding="utf-8", errors="replace") as handle:
                    text = handle.read(4096)
        except OSError:
            text = ""
        result = classify_stderr(text)
        emit(result)
        return 1
    emit({
        "ok": False,
        "reason": "argv-rejected",
        "category": "invalid-cidr",
        "cidr": None,
        "overlapWith": None,
    })
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
