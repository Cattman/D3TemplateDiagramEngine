
/**
 * Prompts the user to upload a file and returns its text content.
 * @param {string} acceptedTypes - Acceptable MIME types or extensions (e.g., ".json,.txt")
 * @returns {Promise<string>} - Resolves to the file content as a string
 */
export function uploadFile(acceptedTypes = "*/*") {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = acceptedTypes;

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) {
        reject("No file selected.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject("File read error.");
      reader.readAsText(file);
    });

    input.click();
  });
}