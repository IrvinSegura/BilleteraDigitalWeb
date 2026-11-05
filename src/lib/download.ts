/** Hands a file the app built or fetched to the browser to save, as if the user had clicked a download link. */
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // The click has started the download by the time the next task runs
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
