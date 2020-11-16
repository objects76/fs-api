window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

window.addEventListener("load", (evt) => {
  console.log("load");
});

let fs;
function errorHandler(e) {
  console.error("Error: " + e);
}

function createFile() {
  fs.root.getFile(
    "log.txt",
    { create: true, exclusive: false },
    (fileEntry)=> {
      console.log(fileEntry);
    },
    errorHandler
  );
}

function readFile() {
  fs.root.getFile(
    "log.txt",
    {},
    (fileEntry)=> {
      // Get a File object representing the file,
      // then use FileReader to read its contents.
      fileEntry.file( (file) => {
        var reader = new FileReader();

        reader.onloadend = (e)=> {
          var txtArea = document.createElement("textarea");
          txtArea.value = this.result;
          document.body.appendChild(txtArea);
        };

        reader.readAsText(file);
      }, errorHandler);
    },
    errorHandler
  );
}

function writeFile(dirEntry) {
  if (!dirEntry) dirEntry = fs.root;
  dirEntry.getFile(
    `log-${Date.now()}.txt`,
    { create: true },
    (fileEntry)=> {
      // Create a FileWriter object for our FileEntry (log.txt).
      fileEntry.createWriter((fileWriter)=> {
        fileWriter.seek(fileWriter.length); // append
        fileWriter.onwriteend = (e)=> {
          console.log("Write completed.");
        };

        fileWriter.onerror = (e)=> {
          console.log("Write failed: " + e.toString());
        };

        // Create a new Blob and write it to log.txt.
        var blob = new Blob(["Lorem Ipsum"], { type: "text/plain" });

        fileWriter.write(blob);
      }, errorHandler);
    },
    errorHandler
  );
}
window.requestFileSystem(window.TEMPORARY, 1 * 1024 * 1024, onInitFs, errorHandler);
function onInitFs(aFS) {
  fs = aFS;
  console.log("Opened file system: " + fs.name);
  //writeFile();
}

function setHandler(selector, callback, eventName = "click") {
  const el = document.querySelector(selector);
  if (!el) {
    console.error(`no element for <${selector}>`);
    return;
  }
  el.addEventListener(eventName, callback);
}
setHandler("#btn1", (evt) => {
  readFile();
});

// copy into fs
function copyFilesIntoWebFS(files) {
  for (const f of files) {
    fs.root.getFile(
      f.name,
      { create: true, exclusive: true },
      (fileEntry)=> {
        fileEntry.createWriter((fileWriter)=> {
          fileWriter.write(f); // Note: write() can take a File or Blob object.
        }, errorHandler);
      },
      errorHandler
    );
  }
}

setHandler(
  "#myfile",
  (e) => {
    copyFilesIntoWebFS(e.target.files);
  },
  "change"
);

// remove file
function removeFile() {
  fs.root.getFile(
    "log.txt",
    { create: false },
    (fileEntry)=> {
      fileEntry.remove(()=> {
        console.log("File removed.");
      }, errorHandler);
    },
    errorHandler
  );
}
setHandler("#btn2", (e) => {
  removeFile();
});

// dir
function createDirs(absPath) {
  const impl = (dirEntry, folders) => {
    // Throw out './' or '/' and move on to prevent something like '/foo/.//bar'.
    if (folders[0] == "." || folders[0] == "") {
      folders = folders.slice(1);
    }

    console.log("curdir=", dirEntry.fullPath, folders[0], folders);
    //if (folders.length == 0) return;
    dirEntry.getDirectory(
      folders[0],
      { create: true },
      (subdirEntry)=> {
        console.log("   new dir:", dirEntry.name, dirEntry.fullPath);
        if (folders.length) {
          impl(subdirEntry, folders.slice(1));
        }
      },
      errorHandler
    );
  };

  impl(fs.root, absPath.split("/"));
}

setHandler("#btn3", (e) => {
  createDirs("/music/genres/jazz/");
});

// list entries

function listResults(entries) {
  // Document fragments can improve performance since they're only appended
  // to the DOM once. Only one browser reflow occurs.
  var fragment = document.createDocumentFragment();

  entries.forEach((entry, i)=> {
    var li = document.createElement("li");
    li.innerHTML = `<span>${entry.isDirectory ? "+" : " "} ${entry.name}</span>`;
    fragment.appendChild(li);
  });

  document.querySelector("#filelist").appendChild(fragment);
}

//
//
//
function getDirectoryEntry(path) {
  const folders = path.split("/");
  return new Promise((resolve, reject)=> {
    const impl = (curDir, folders, i) => {
      curDir.getDirectory(
        folders[i],
        { create: false },
        (theDir) => {
          if (++i === folders.length) resolve(theDir);
          else {
            impl(theDir, folders, i);
          }
        },
        reject // (error)=>{}
      );
    };

    impl(fs.root, folders, 0);
  });
}

function getFileEntries(path) {
  return new Promise((resolve, reject)=> {
    getDirectoryEntry(path).then((dirEntry) => {
      dirEntry.createReader().readEntries(resolve, reject);
    }, reject);
  });
}

async function getFileEntriesRecursively(path) {
  let results = await getFileEntries(path);

  for (const entry of results) {
    if (entry.isDirectory) {
      results = [...results, ...(await getFileEntriesRecursively(entry.fullPath)];
    }
  }

  return results;
}

setHandler("#btn4", async (e) => {
  // create file in music/genres/
  //getDirectoryEntry("music/genres").then((dir) => writeFile(dir), errorHandler);
  //return;
  {
    const entries = await getFileEntriesRecursively("music");
    console.log(entries);
    return;
  }

  getFileEntries("music/genres").then((entries) => {
    console.log("entries=", entries);
    return;
);
