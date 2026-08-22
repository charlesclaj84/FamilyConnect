import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_FORMATS, IMAGE_FORMATS, acceptAttribute, extensionOf, formatList,
  isAllowedUpload, uploadRejection,
} from './upload-types'

/**
 * What may be uploaded. The list is the SERVER's gate as well as the picker's hint, so this is
 * the test of a boundary rather than of a convenience.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL (AGENTS.md §7b). Mutations applied
 * one at a time to `lib/upload-types.ts`:
 *
 *   `isAllowedUpload` returning true on an empty extension
 *       trips "a file with no extension is refused"
 *   the MIME half dropped (extension alone decides)
 *       trips "an executable renamed to .pdf is refused"
 *   the absent-MIME allowance dropped (`if (!type) return false`)
 *       trips "a .csv the operating system does not recognise is accepted"
 *   `extensionOf` using the FIRST dot
 *       trips "reads the last extension of a doubled name"
 *   `.svg` or `.heic` added to IMAGE_FORMATS
 *       trips "the image list is exactly the four the gallery can display"
 */

describe('extensionOf', () => {
  it('reads the last extension of a doubled name', () => {
    // THE ATTACK SHAPE: `payload.pdf.exe` is an executable, and a first-dot reading calls it
    // a PDF. The browser and the operating system both take the last one, so anything else
    // here disagrees with what will actually happen when somebody double-clicks it.
    expect(extensionOf('payload.pdf.exe')).toBe('.exe')
    expect(extensionOf('minutes.2026.docx')).toBe('.docx')
  })

  it('lower-cases, because a picker will hand back .JPG', () => {
    expect(extensionOf('HOLIDAY.JPG')).toBe('.jpg')
  })

  it('answers empty for a name with no extension to read', () => {
    expect(extensionOf('minutes')).toBe('')
    expect(extensionOf('trailing.')).toBe('')
    // A LEADING DOT IS NOT AN EXTENSION. `.htaccess` is a whole file name, and reading it as
    // one falls through to "not on the list", which is the safe direction.
    expect(extensionOf('.htaccess')).toBe('')
  })
})

describe('isAllowedUpload — images', () => {
  it('takes the four formats every browser can display', () => {
    expect(isAllowedUpload('a.jpg', 'image/jpeg', IMAGE_FORMATS)).toBe(true)
    expect(isAllowedUpload('a.jpeg', 'image/jpeg', IMAGE_FORMATS)).toBe(true)
    expect(isAllowedUpload('a.png', 'image/png', IMAGE_FORMATS)).toBe(true)
    expect(isAllowedUpload('a.webp', 'image/webp', IMAGE_FORMATS)).toBe(true)
    expect(isAllowedUpload('a.gif', 'image/gif', IMAGE_FORMATS)).toBe(true)
  })

  it('the image list is exactly the four the gallery can display', () => {
    // SVG IS EXCLUDED AS A SECURITY DECISION and HEIC as a compatibility one — both argued in
    // the module header. Asserted as an exact set rather than two `.toBe(false)` calls, so
    // that ADDING one is what goes red: a `.toBe(false)` per format only catches removal.
    expect(IMAGE_FORMATS.flatMap(f => f.extensions).sort()).toEqual(
      ['.gif', '.jpeg', '.jpg', '.png', '.webp'],
    )
    expect(isAllowedUpload('logo.svg', 'image/svg+xml', IMAGE_FORMATS)).toBe(false)
    expect(isAllowedUpload('photo.heic', 'image/heic', IMAGE_FORMATS)).toBe(false)
  })

  it('refuses a document on the gallery and an image on the documents screen', () => {
    // THE TWO LISTS ARE NOT INTERCHANGEABLE, which is the whole reason there are two.
    expect(isAllowedUpload('bylaws.pdf', 'application/pdf', IMAGE_FORMATS)).toBe(false)
    expect(isAllowedUpload('holiday.jpg', 'image/jpeg', DOCUMENT_FORMATS)).toBe(false)
  })
})

describe('isAllowedUpload — documents', () => {
  it('takes both generations of Word and Excel', () => {
    // A family's records are decades old: `.doc` and `.xls` are what a document written in
    // 2004 IS, and refusing them refuses the archive this screen exists to hold.
    expect(isAllowedUpload('a.doc', 'application/msword', DOCUMENT_FORMATS)).toBe(true)
    expect(isAllowedUpload(
      'a.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      DOCUMENT_FORMATS,
    )).toBe(true)
    expect(isAllowedUpload('a.xls', 'application/vnd.ms-excel', DOCUMENT_FORMATS)).toBe(true)
    expect(isAllowedUpload(
      'a.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      DOCUMENT_FORMATS,
    )).toBe(true)
    expect(isAllowedUpload('a.pdf', 'application/pdf', DOCUMENT_FORMATS)).toBe(true)
    expect(isAllowedUpload('a.csv', 'text/csv', DOCUMENT_FORMATS)).toBe(true)
  })

  it('a .csv the operating system does not recognise is accepted', () => {
    // `File.type` is the BROWSER's guess and is empty for a format the OS has no application
    // for. Refusing that would refuse a perfectly ordinary CSV on a machine with no
    // spreadsheet installed, which is a real reader on a real laptop.
    expect(isAllowedUpload('members.csv', '', DOCUMENT_FORMATS)).toBe(true)
    expect(isAllowedUpload('members.csv', undefined, DOCUMENT_FORMATS)).toBe(true)
    expect(isAllowedUpload('members.csv', 'text/plain', DOCUMENT_FORMATS)).toBe(true)
  })

  it('but an absent type does not excuse an extension that is not on the list', () => {
    // The allowance above is about the TYPE being unknown, never about the extension.
    expect(isAllowedUpload('notes.txt', '', DOCUMENT_FORMATS)).toBe(false)
    expect(isAllowedUpload('run.exe', '', DOCUMENT_FORMATS)).toBe(false)
  })

  it('an executable renamed to .pdf is refused', () => {
    // THE REASON BOTH HALVES ARE CHECKED. The extension now says PDF and the browser still
    // reports what the file actually is, so the pair disagree and the pair is what decides.
    expect(isAllowedUpload('payload.pdf', 'application/x-msdownload', DOCUMENT_FORMATS))
      .toBe(false)
    expect(isAllowedUpload('payload.pdf', 'application/octet-stream', DOCUMENT_FORMATS))
      .toBe(false)
  })

  it('reads a type with parameters, which is what a real multipart body carries', () => {
    expect(isAllowedUpload('a.csv', 'text/csv; charset=utf-8', DOCUMENT_FORMATS)).toBe(true)
    expect(isAllowedUpload('a.pdf', 'APPLICATION/PDF', DOCUMENT_FORMATS)).toBe(true)
  })

  it('a file with no extension is refused', () => {
    expect(isAllowedUpload('minutes', 'application/pdf', DOCUMENT_FORMATS)).toBe(false)
    expect(isAllowedUpload('', 'application/pdf', DOCUMENT_FORMATS)).toBe(false)
  })
})

describe('the copy and the accept attribute are derived', () => {
  it('lists every extension and every type', () => {
    const accept = acceptAttribute(IMAGE_FORMATS)
    // BOTH, because browsers disagree about which they honour — see the module header.
    expect(accept).toContain('.jpg')
    expect(accept).toContain('image/jpeg')
    expect(accept).not.toContain('.svg')
  })

  it('reads as a sentence', () => {
    expect(formatList(IMAGE_FORMATS)).toBe('JPEG, PNG, WebP or GIF')
    expect(formatList(DOCUMENT_FORMATS)).toBe('PDF, Word, Excel or CSV')
    expect(formatList([])).toBe('')
    expect(formatList([IMAGE_FORMATS[0]])).toBe('JPEG')
  })

  it('the refusal names the file and what was wrong with it', () => {
    // A refusal that says only "invalid file" makes somebody try the same file again.
    expect(uploadRejection('run.exe', DOCUMENT_FORMATS)).toContain('.exe')
    expect(uploadRejection('run.exe', DOCUMENT_FORMATS)).toContain('PDF, Word, Excel or CSV')
    expect(uploadRejection('minutes', DOCUMENT_FORMATS)).toContain('no file extension')
  })
})
