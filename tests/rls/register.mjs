/** Installs the resolution hooks. Used as `node --import ./tests/rls/register.mjs …`. */
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('./hooks.mjs', pathToFileURL(import.meta.filename))
