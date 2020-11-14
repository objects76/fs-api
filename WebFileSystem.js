window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
window.URL = window.URL || window.webkitURL;

const onError = (e) => {
  logger.log("FS error: " + e.code + " - " + e.name, ":", e);
};

export default class WebFileSystem {
  constructor() {
    this.fs = undefined;
  }

  clear = () => {
    this.fs.root.createReader().readEntries((results) => {
      for (const entry of results) {
        if (entry.isDirectory) {
          entry.removeRecursively(() => {}, onError);
        } else {
          entry.remove(() => {}, onError);
        }
      }
      getAllEntries(this.fs.root);
    }, onError);
  };

  open = (storageSize = 1024 * 1024, temp = true) => {
    const onDone = (aFS) => {
      this.fs = aFS;
      console.log("Opened file system: " + aFS.name);
    };

    if (temp) {
      window.requestFileSystem(TEMPORARY, storageSize, onDone, onError);
    } else {
      window.webkitStorageInfo.requestQuota(
        PERSISTENT,
        storageSize,
        (grantedBytes) => {
          window.requestFileSystem(PERSISTENT, grantedBytes, onDone, onError);
        },
        (e) => {
          console.error("Error", e);
        }
      );
    }
  };

  _directoryOpRecursively = (path, create) => {
    return new Promise((resolve, reject) => {
      const impl = (curDir, folders, i) => {
        curDir.getDirectory(
          folders[i],
          { create },
          (theDir) => {
            if (++i === folders.length) resolve(theDir);
            else {
              impl(theDir, folders, i);
            }
          },
          reject // (error)=>{}
        );
      };

      impl(this.fs.root, path.split("/"), 0);
    });
  };
  createDirectoryRecursively = (path) => this._directoryOpRecursively(path, true);
  getDirectoryEntry = (path) => this._directoryOpRecursively(path, false);

  getFileEntries = (path) => {
    return new Promise((resolve, reject) => {
      this.getDirectoryEntry(path).then((dirEntry) => {
        dirEntry.createReader().readEntries(resolve, reject);
      }, reject);
    });
  };

  getFileEntriesRecursively = async (path) => {
    let results = await this.getFileEntries(path);

    for (const entry of results) {
      if (entry.isDirectory) {
        results = [...results, ...(await this.getFileEntriesRecursively(entry.fullPath))];
      }
    }

    return results;
  };

  // delete
  deleteEntry = (entry) => {
    return new Promise((resolve, reject) => {
      if (entry.isDirectory) {
        entry.removeRecursively(resolve, reject);
      } else {
        entry.remove(resolve, reject);
      }
    });
  };

  // openfile
  // mode = 'r': read
  //        'a or w': write(overwrite)
  //        'a+': append
  //    resolve: (fileWriter)=>{} for write, or (fileBlob)=>{} for read.
  //    reject: (error) =>{}
  openFile = (path, mode = "a+") => {
    const create = mode !== "r";
    const file = path.substring(path.lastIndexOf("/") + 1);
    const folder = path.substring(0, path.lastIndexOf("/"));
    return new Promise((resolve, reject) => {
      this.getDirectoryEntry(folder).then((dir) => {
        dir.getFile(
          file,
          { create, exclusive: false },
          (fileEntry) => {
            if (create) {
              fileEntry.createWriter((fileWriter) => {
                if (mode.includes("+")) fileWriter.seek(fileWriter.length);
                fileWriter.onwritestart = () => console.log("WRITE START");
                fileWriter.onwriteend = () => console.log("WRITE END");

                resolve(fileWriter);
                // fileWriter.write(blob)
              }, reject);
            } else {
              fileEntry.file((fileBlob) => {
                resolve(fileBlob);
              }, reject);
            }
          },
          reject
        );
      }, reject);
    });
  };
} // class

// test
/* <button id="btn1">read file</button>
<button id="btn2">remove file</button>
<button id="btn3">directory test</button>
<button id="btn4">list entries</button> */

const setHandler = (selector, callback, eventName = "click") => {
  const el = document.querySelector(selector);
  if (!el) {
    console.error(`no element for <${selector}>`);
    return;
  }
  el.addEventListener(eventName, callback);
};
window.addEventListener("load", (evt) => {
  console.log("load");
});

const fs = new WebFileSystem();
fs.open();

setHandler("#btn1", async (evt) => {
  // write
  {
    const fileWriter = await fs.openFile("/read_write.txt", "a+");
    var blob = new Blob(["Lorem Ipsum"], { type: "text/plain" });
    fileWriter.write(blob);
  }
  // read
  {
    const fileBlob = await fs.openFile("/read_write.txt", "r");
    const reader = new FileReader();
    reader.onloadend = (evt) => {
      console.log(evt.target.result);
    };
    reader.readAsText(fileBlob);
  }
});

setHandler("#btn4", async () => {
  const entries = await fs.getFileEntriesRecursively("/");
  console.log(entries);
});
