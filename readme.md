# to es6

- function\s*\(([^)]*)\)\s\*\{ => (\$1)=> {

# ref:

    https://www.html5rocks.com/en%2Ftutorials%2Ffile%2Ffilesystem%2F%2F

# callback to promise:

```js
    old: callbackfn(callback_when_ok, callback_when_ng);

    =>
    new Promise((ok,ng)=> {
        if ("something is failed")
            ng(new Error("something is failed"));
        else
            callbackfn(ok, ng?);
    })
```

# vsc hold last commit message

## 1. just use Alt +Up/Down arrow key

## 2. or use git hooks

```bash
$>
    echo "My fancy commit message" > .git/last-commit-msg.txt
    git config --local commit.template .git/last-commit-msg.txt


#!/bin/sh
#
# .git/hooks/post-commit
printf "`git log -1 --pretty=%s`" > .git/last-commit-msg.txt


$>
    chmod +x .git/hooks/post-commit
```
