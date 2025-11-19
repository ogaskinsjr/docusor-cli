DocuSOR
👉 For a full step-by-step example, see the [README.md](./README.md).

Test your documentation to make sure it works as expected

To show how it works, you can run DocuSOR against itself
1. the first node block creates a server on port 8080
2. Well wait for it to spin up
3. DocuSOR will wait for a 200 on that port for 6 seconds
4. assure that echo ok comes from the server
5. confirms readme.md exists
6. confirms that walkthrough.md exists

Super simple implementation, for more indepth walkthrough, reference this test repo we have set up :D

```bash
node -e "require('http').createServer((req,res)=>{res.statusCode=200;res.end('ok');}).listen(8080)" >/tmp/docusor-node.log 2>&1 & echo $! >/tmp/docusor-node.pid

# waitFor: portOpen 127.0.0.1 8080 6s
# assert: httpOk http://localhost:8080/
# assert: httpStatus GET http://localhost:8080/ 200
# assert: commandSucceeds "echo ok"
# assert: fileExists README.md
# assert: fileExists README_DEMO.md

kill $(cat /tmp/docusor-node.pid) || true
rm -f /tmp/docusor-node.pid
```

