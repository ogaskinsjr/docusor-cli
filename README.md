Veridocs

Test your documentation to make sure it works as expected

```bash
# Start a tiny Node HTTP server on port 8080 (background)
node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.end('ok');}).listen(8080)" >/tmp/veridocs-node.log 2>&1 & echo $! >/tmp/veridocs-node.pid

# Wait for it to be reachable, then assert responses and basics
# waitFor: portOpen 127.0.0.1 8080 20
# assert: httpOk http://localhost:8080/
# assert: httpStatus GET http://localhost:8080/ 200
# assert: commandSucceeds "echo ok"
# assert: fileExists README.md
# assert: fileExists WALKTHROUGH.md

# Cleanup the server
kill $(cat /tmp/veridocs-node.pid) || true
rm -f /tmp/veridocs-node.pid
```

