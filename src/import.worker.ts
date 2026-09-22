import { readImport } from "./import";
self.onmessage = (
  event: MessageEvent<{ buffer: ArrayBuffer; name: string }>,
) => {
  try {
    self.postMessage({
      ok: true,
      result: readImport(event.data.buffer, event.data.name),
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not read this file. Try exporting it again as Excel or CSV.",
    });
  }
};
