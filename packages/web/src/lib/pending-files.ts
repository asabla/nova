/**
 * Transient store for files selected on the home page that need to be
 * carried over to the new conversation page. File objects can't be
 * serialized to sessionStorage, so we use a module-level variable.
 * Files are consumed (cleared) on first read.
 */
let _files: File[] = [];

export function setPendingFiles(files: File[]) {
  _files = files;
}

export function consumePendingFiles(): File[] {
  const f = _files;
  _files = [];
  return f;
}
