import http.server
import socketserver
from urllib.parse import urlparse, parse_qs

PORT = 3000

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)

        # Если пользователь обращается к /do?cmd=...
        if parsed_url.path == "/do":
            qs = parse_qs(parsed_url.query)
            cmd = qs.get("cmd", [""])[0]
            print("Got cmd:", cmd)  # "play 1", "pause", etc.

            # Отправим текстовый ответ
            self.send_response(200)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            self.end_headers()

            msg = f"OK, got cmd: {cmd}"
            self.wfile.write(msg.encode("utf-8"))
        
        else:
            # Во всех остальных случаях (включая /songs/songX.mp3,
            # /index.html, /script.js, /styles.css) используем "родительское"
            # поведение SimpleHTTPRequestHandler, которое ищет файл на диске
            super().do_GET()

with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    print(f"Serving on port {PORT}...")
    httpd.serve_forever()
