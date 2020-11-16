window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
window.URL = window.URL || window.webkitURL;

window.requestPersistentStorageQuota = (size, ok, ng) => {
  if (navigator.webkitPersistentStorage) navigator.webkitPersistentStorage.requestQuota(size, ok, ng);
  else if (window.webkitStorageInfo) window.webkitStorageInfo.requestQuota(PERSISTENT, size, ok, ng);
  else throw Error("webkitStorageInfo is not defined");
};

// wrapper of FileSystem WebAPI
//  - callback type of WebAPI => Promise based.

const getByteSize = (n) => {
  if (n < 1024) return n + " bytes";
  if (n < 1024 * 1024) return (n / 1024).toFixed(2) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
};

export default class WebFileSystem {
  constructor() {
    this.fs = undefined;
  }

  freeStorage = async () => {
    // ????
  };

  clear = async () => {
    try {
      const results = await new Promise((ok, ng) => {
        this.fs.root.createReader().readEntries(ok, ng);
      });

      await Promise.all(
        results.map((entry) => {
          return new Promise((ok, ng) => {
            if (entry.isDirectory) entry.removeRecursively(ok, ng);
            else entry.remove(ok, ng);
          });
        })
      );

      console.log("fs cleared");
    } catch (err) {
      return Promise.reject(err);
    }
  };

  open = async (storageSize = 1024 * 1024, temp = true) => {
    WebFileSystem.dumpQuota();
    try {
      if (!temp) {
        // https://stackoverflow.com/questions/17809824/how-to-use-navigator-instead-of-window-webkitstorageinfo-html5-file-system-api
        const requestedSize = storageSize;
        storageSize = await new Promise((ok, ng) => {
          window.requestPersistentStorageQuota(requestedSize, ok, ng);
        });
      }

      this.fs = await new Promise((ok, ng) =>
        window.requestFileSystem(temp ? TEMPORARY : PERSISTENT, storageSize, ok, ng)
      );
      console.log("Opened file system:", this.fs.name, "storageSize=", storageSize);
      WebFileSystem.dumpQuota();
    } catch (err) {
      return Promise.reject(err);
    }
  };

  _directoryOpRecursively = (path, create) => {
    const folders0 = path.split("/").filter((name) => name.length > 0);
    if (folders0.length === 0) return Promise.resolve(this.fs.root);

    return new Promise((ok, ng) => {
      const impl = (curDir, folders, i) => {
        curDir.getDirectory(
          folders[i],
          { create },
          (theDir) => {
            if (++i === folders.length) ok(theDir);
            else impl(theDir, folders, i);
          },
          ng // (error)=>{}
        );
      };

      impl(this.fs.root, folders0, 0);
    });
  };

  createDirectory = (path) => this._directoryOpRecursively(path, true);
  getDirectory = (path) => this._directoryOpRecursively(path, false);

  getFileEntries = async (path) => {
    const dirEntry = await this.getDirectory(path);
    return new Promise((ok, ng) => dirEntry.createReader().readEntries(ok, ng)); // ok(entries)
  };

  getFileEntriesRecursively = async (path) => {
    let entries = await this.getFileEntries(path);

    for (const entry of entries) {
      if (entry.isDirectory) {
        entries = [...entries, ...(await this.getFileEntriesRecursively(entry.fullPath))];
      }
    }

    return entries;
  };

  // delete
  deleteEntry = async (path) => {
    return new Promise((ok, ng) => {
      this._getEntry(path).then((entry) => {
        if (entry.isDirectory) {
          entry.removeRecursively(ok, ng);
        } else {
          entry.remove(ok, ng);
        }
        console.log(path, "is deleted");
      }, ng);
    });
  };

  _getEntry = async (path, create, dirEntry = undefined) => {
    if (!dirEntry) {
      const folder = path.substring(0, path.lastIndexOf("/"));
      dirEntry = await this.getDirectory(folder);
    }

    if (!dirEntry) Promise.reject(new Error("No directory:" + path));
    const filename = path.substring(path.lastIndexOf("/") + 1);
    return new Promise((ok, ng) => {
      dirEntry.getFile(filename, { create, exclusive: false }, ok, ng);
    });
  };

  // openfile
  // mode = 'r': read
  //        'a or w': write(overwrite)
  //        'a+': append
  //    resolve: (fileWriter)=>{} for write, or (fileBlob)=>{} for read.
  //    reject: (error) =>{}
  openFile = async (path, mode = "a+", dirEntry = undefined) => {
    const create = mode !== "r";
    const fileEntry = await this._getEntry(path, create, dirEntry);
    if (!fileEntry) Promise.reject(new Error("No entry:" + path));

    return new Promise((ok, ng) => {
      if (create) {
        fileEntry.createWriter((fileWriter) => {
          if (mode.includes("+")) fileWriter.seek(fileWriter.length);
          // fileWriter.onwritestart = () => console.log("WRITE START");
          // fileWriter.onwriteend = () => console.log("WRITE END");
          fileWriter.writeAsync = (blob) => {
            return new Promise((ok, ng) => {
              fileWriter.write(blob);
              fileWriter.onwriteend = () => ok(blob);
              fileWriter.onerror = ng;
            });
          };
          console.log(`open(${path}, ${mode})`);
          ok(fileWriter);
        }, ng);
      } else {
        fileEntry.file((fileBlob) => {
          console.log(`open(${path}, ${mode})`);
          ok(fileBlob);
        }, ng);
      }
    });
  };

  download = async (path, downloaded_name = undefined) => {
    const fileBlob = await this.openFile(path, "r");

    if (!downloaded_name) downloaded_name = path.substring(path.lastIndexOf("/") + 1);
    downloadBlob(fileBlob, downloaded_name);
  };

  saveAs = async (fileblob, destPath) => {
    try {
      const fileWriter = await this.openFile(destPath, "a");
      const writtenBlob = await fileWriter.writeAsync(fileblob);
      console.log("write done for", destPath, "blob=", writtenBlob);
    } catch (err) {
      console.error("save ", destPath, err);
      this.deleteEntry(destPath);
    }
  };
  save = async (fileblob, destFolder = "") => {
    this.saveAs(fileblob, destFolder + "/" + fileblob.name);
  };

  // static

  static dumpQuota = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      console.log(`Persisted storage granted: ${isPersisted}`);
    }

    if (navigator.webkitTemporaryStorage) {
      // navigator.webkitTemporaryStorage.requestQuota(Number.MAX_SAFE_INTEGER, (grantedBytes) => {
      //   console.log(`TemporaryStorage: usable size=${getByteSize(grantedBytes)}`);
      // });
      navigator.webkitTemporaryStorage.queryUsageAndQuota(
        (usedBytes, grantedBytes) =>
          console.log(`TemporaryStorage: ${getByteSize(usedBytes)}/${getByteSize(grantedBytes)}`),
        (e) => console.log("Error", e)
      );
    }
    if (navigator.webkitPersistentStorage) {
      // navigator.webkitPersistentStorage.requestQuota(Number.MAX_SAFE_INTEGER, (grantedBytes) => {
      //   console.log(`PersistentStorage: usable size=${getByteSize(grantedBytes)}`);
      // });
      navigator.webkitPersistentStorage.queryUsageAndQuota(
        (usedBytes, grantedBytes) =>
          console.log(`PersistentStorage: ${getByteSize(usedBytes)}/${getByteSize(grantedBytes)}`),
        (e) => console.log("Error", e)
      );
    }

    navigator?.storage?.estimate().then(function (estimate) {
      console.log("usage=", estimate.usage, getByteSize(estimate.quota));
    });
    // test
    // navigator.storageQuota.queryInfo("temporary").then((info) => console.info(info));
    // navigator.storageQuota.queryInfo("persistent").then((info) => console.info(info));
    navigator?.storage?.persisted().then(function (persistent) {
      if (persistent) console.log("Storage will not be cleared except by explicit user action");
      else console.log("Storage may be cleared by the UA under storage pressure.");
    });
  };
} // class

function downloadBlob(blob, destName) {
  const link = document.createElement("a");

  link.download = destName;
  link.href = window.URL.createObjectURL(blob);

  const clickEvent = document.createEvent("MouseEvents");
  clickEvent.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
  link.dispatchEvent(clickEvent);
}

//------------------------------------------------------------------------------
// test: utils for test setup.
//------------------------------------------------------------------------------
document.body.insertAdjacentHTML("beforeend", `<div id='test-buttons' style="width: 100%"></div>`);
document.head.insertAdjacentHTML(
  "beforeend",
  `<style>
  #test-buttons 
  button, input {
      display: block;
      width: 15rem;
      margin: 0.5em auto;
      box-sizing: border-box;
    }
</style>`
);

const setHandler = (element, callback = undefined, eventName = "click") => {
  document.querySelector("#test-buttons").insertAdjacentHTML("beforeend", element);

  const match = /id=['"]([^'"]+)/g.exec(element);
  if (match && callback) {
    const el = document.querySelector("#" + match[1]);
    if (el) el.addEventListener(eventName, callback);
    else console.error(`no element for <${selector}>`);
  }
};
//window.addEventListener("load", (evt) => console.log("load"));

//------------------------------------------------------------------------------
// test body:
//------------------------------------------------------------------------------
const fs = new WebFileSystem();

setHandler(`<button id='fs-open'>fs open</button>`, async (evt) => {
  fs.open(1024 * 8, false);
  //fs.clear();
});
setHandler(`<button id='fs-clear'>fs clear</button>`, async (evt) => {
  fs.clear();
});

setHandler(`<button id='fs-quota'>fs quota</button>`, async (evt) => {
  WebFileSystem.dumpQuota();
});

setHandler(`<hr/><button id='read-write' >read/write</button>`, async (evt) => {
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
});
setHandler(`<button id='delete'>delete</button>`, async (evt) => {
  let path = document.querySelector("#test-path").value;
  if (!path) path = "/childProcess.execSync.png";
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
