#!/usr/bin/env python3
"""
IT Onsite Weekly Shift - Local Server
Run with: python3 server.py
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print(f"🚀 IT Onsite Weekly Shift 웹 서버가 실행되었습니다!")
        print(f"👉 브라우저 주소: {url}")
        print("=" * 60)
        print("서버를 종료하려면 Ctrl+C를 누르세요.\n")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n웹 서버가 종료되었습니다.")
            sys.exit(0)

if __name__ == '__main__':
    main()
