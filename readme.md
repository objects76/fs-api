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
