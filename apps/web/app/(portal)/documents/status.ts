// Labels for document and version states, shared by the subject and document pages.
export const VERSION_STATUS: Record<string, [label: string, tone: string]> = {
  uploading: ['Uploading', 'warn'],
  queued: ['Waiting', 'warn'],
  processing: ['Processing', 'warn'],
  ready: ['Ready', 'good'],
  failed: ['Failed', 'bad'],
};

export const DOCUMENT_STATUS: Record<string, [label: string, tone: string]> = {
  draft: ['Not published', ''],
  published: ['Published', 'good'],
  withdrawn: ['Withdrawn', 'bad'],
};

// error_code values written by the worker (apps/worker/src/extract.ts, ingest.ts).
export const ERROR_TEXT: Record<string, string> = {
  empty_file: 'The file is empty.',
  too_large: 'The file is larger than 50 MB.',
  wrong_file_type: 'The file is not a real PDF, PNG or JPG.',
  corrupt_file: 'The PDF is damaged and cannot be read.',
  too_many_pages: 'The PDF has more than 300 pages. Split it and upload the parts.',
  no_text: 'No text could be read from this file.',
  file_missing: 'The upload did not finish. Upload the file again.',
  internal: 'Something went wrong while processing. Try again.',
};
