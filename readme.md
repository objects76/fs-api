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

# test code

```js
//------------------------------------------------------------------------------
// test body:
//------------------------------------------------------------------------------
const fs = new WebFileSystem();
fs.open();

setHandler(`<button id='fs-clear'>fs clear(erase all)</button>`, async (evt) => {
  fs.clear();
});

setHandler(`<button id='read-write' >read/write</button>`, async (evt) => {
  let text_path = "/folder1/folder2 withspace/read_ write.txt"; // white space in file or folder.
  // write
  try {
    const folder = await fs.createDirectory(text_path.substring(0, text_path.lastIndexOf("/")));
    const fileWriter = await fs.openFile(text_path, "a+", folder);

    for (let i = 0; i < 10; ++i) {
      const blob = new Blob([new Date().toLocaleString() + "-" + Date.now() + "\n"], { type: "text/plain" });
      await fileWriter.writeAsync(blob);
    }
    console.log("write done");
  } catch (err) {
    console.error(err);
  }

  // read
  try {
    const folder = undefined; //await fs.getDirectory(text_path.substring(0, text_path.lastIndexOf("/")));
    const fileBlob = await fs.openFile(text_path, "r", folder);
    const reader = new FileReader();
    reader.onloadend = (evt) => console.log(evt.target.result);
    reader.readAsText(fileBlob);
  } catch (err) {
    console.error(err);
  }

  // download
  try {
    fs.download(text_path);
    //fs.deleteEntry(text_path);
  } catch (err) {
    console.error(err);
  }
});

setHandler(`<hr/><input id='test-path' />`);
setHandler(`<button id='get-entries' >get entries</button>`, async () => {
  let path = document.querySelector("#test-path").value;
  const entries = await fs.getFileEntriesRecursively(path ? path : "/");
  console.log(entries);
});

setHandler(`<button id='download' >download</button>`, async (evt) => {
  let path = document.querySelector("#test-path").value;
  if (!path) path = "/childProcess.execSync.png";
  await fs.download(path);
  await fs.deleteEntry(path);
});

// add local file to FS.
setHandler("<hr/>");
setHandler(
  `<input type="file" id="myfile" multiple />`,
  async (e) => {
    await fs.createDirectory("/upload");
    for (const f of e.target.files) {
      fs.save(f, "/upload");
    }
  },
  "change"
);
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
