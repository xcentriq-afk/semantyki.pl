#!/usr/bin/env python3
import json
import os
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

REPO = "xcentriq-afk/semantyki-data"
TAG = "data"
TOKEN_FILE = os.path.expanduser("~/.secrets/gh_backup_token")
WEBHOOK_FILE = os.path.expanduser("~/.secrets/discord_webhook")
SRC = "/opt/semantyki/pipeline/data"
STAMP = time.strftime("%Y-%m-%d", time.gmtime())
ASSET = f"data-{STAMP}.tar.gz"
RETENTION_DAYS = 7

token = ""


def alert(msg):
    try:
        with open(WEBHOOK_FILE) as f:
            url = f.read().strip()
        if not url:
            return
        req = urllib.request.Request(
            url,
            data=json.dumps(
                {
                    "username": "SEMANTYKI.pl Backup",
                    "content": f"```{msg[:1800]}```",
                }
            ).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


def api(method, url, data=None, headers=None):
    h = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "semantyki-backup/1.0",
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read() or b"{}")


def main():
    global token
    try:
        with open(TOKEN_FILE) as f:
            token = f.read().strip()
    except Exception as e:
        print("brak tokenu:", e)
        sys.exit(1)

    tmp_path = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=".tar.gz")
        os.close(fd)
        with tarfile.open(tmp_path, "w:gz") as tar:
            tar.add(SRC, arcname="pipeline/data")
        size_mb = os.path.getsize(tmp_path) / 1048576

        try:
            rel = api("GET", f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}")
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
            rel = api(
                "POST",
                f"https://api.github.com/repos/{REPO}/releases",
                data=json.dumps(
                    {
                        "tag_name": TAG,
                        "name": "Snapshot danych",
                        "body": "Nocny backup pipeline/data (nadpisywany).",
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            )
        rel_id = rel["id"]

        assets = api(
            "GET",
            f"https://api.github.com/repos/{REPO}/releases/{rel_id}/assets?per_page=100",
        )

        for a in assets:
            if a["name"] == ASSET:
                api(
                    "DELETE",
                    f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}",
                )
                break

        with open(tmp_path, "rb") as f:
            api(
                "POST",
                f"https://uploads.github.com/repos/{REPO}/releases/{rel_id}/assets?name={ASSET}",
                data=f.read(),
                headers={"Content-Type": "application/octet-stream"},
            )

        cutoff = time.time() - RETENTION_DAYS * 86400
        for a in assets:
            if a["name"].startswith("data-") and a["name"] != ASSET:
                d = a["name"][5:15]
                try:
                    ts = time.mktime(time.strptime(d, "%Y-%m-%d"))
                    if ts < cutoff:
                        api(
                            "DELETE",
                            f"https://api.github.com/repos/{REPO}/releases/assets/{a['id']}",
                        )
                except ValueError:
                    pass
        print(f"OK {ASSET} ({size_mb:.1f} MB)")
    except Exception as e:
        print(f"{type(e).__name__}: {e}", file=sys.stderr)
        alert(f"Backup SEMANTYKI.pl NIE UDAŁ SIĘ: {type(e).__name__}: {e}")
        sys.exit(1)
    finally:
        if tmp_path:
            os.unlink(tmp_path)


if __name__ == "__main__":
    main()
