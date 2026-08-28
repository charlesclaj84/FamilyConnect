import { describe, expect, it } from 'vitest'

import {
  CHANNELS, NOTIFICATIONS, channelDefault, mayNotify, notificationByKey, prefEnabled,
  type NotificationPref,
} from './notification-prefs'

/**
 * ── MUTATION-CHECKED, per AGENTS.md §7b: "a green run is not evidence until you have seen it
 * fail". Each of these trips a distinct set:
 *
 *   `prefEnabled` returning `false` for an absent row          -> the two default cases
 *   `prefEnabled` ignoring the `unavailable` guard             -> the push cases
 *   `prefEnabled` reading the catalogue instead of the row     -> both override cases
 *   `mayNotify` dropping its `reachable` conjunct              -> the reachability cases
 */

const pref = (
  notificationKey: string,
  channel: NotificationPref['channel'],
  optedIn: boolean,
): NotificationPref => ({ notificationKey, channel, optedIn })

describe('the catalogue', () => {
  it('has an entry for every notification key it lists, once', () => {
    const keys = NOTIFICATIONS.map(n => n.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('states a default for every channel, so no cell can be undecided', () => {
    for (const n of NOTIFICATIONS) {
      for (const c of CHANNELS) {
        expect(n.defaults[c], `${n.key}/${c}`).toBeDefined()
      }
    }
  })

  it('never defaults SMS on — consent to be texted is an act, never an oversight', () => {
    for (const n of NOTIFICATIONS) {
      expect(n.defaults.sms, n.key).not.toBe('opt-out')
    }
  })

  it('answers unavailable for a key it does not know, rather than throwing', () => {
    expect(notificationByKey('not_a_thing')).toBeNull()
    expect(channelDefault('not_a_thing', 'email')).toBe('unavailable')
  })
})

describe('prefEnabled', () => {
  it('is TRUE for an opt-out cell nobody has touched', () => {
    // The member has never opened the screen. A safety check-in still reaches them by email.
    expect(prefEnabled([], 'safety_check', 'email')).toBe(true)
  })

  it('is FALSE for an opt-in cell nobody has touched', () => {
    expect(prefEnabled([], 'safety_check', 'sms')).toBe(false)
  })

  it('lets a stored answer override an opt-out default', () => {
    expect(prefEnabled([pref('safety_check', 'email', false)], 'safety_check', 'email')).toBe(false)
  })

  it('lets a stored answer override an opt-in default', () => {
    expect(prefEnabled([pref('safety_check', 'sms', true)], 'safety_check', 'sms')).toBe(true)
  })

  it('is FALSE for an unavailable channel even with a stored opt-in', () => {
    // A row from before the channel was retired, or a hand-written insert. The catalogue is
    // the authority on whether a channel is real.
    expect(prefEnabled([pref('safety_check', 'push', true)], 'safety_check', 'push')).toBe(false)
  })

  it('is FALSE for a notification key that is not in the catalogue', () => {
    expect(prefEnabled([pref('retired', 'email', true)], 'retired', 'email')).toBe(false)
  })

  it('does not let one channel\'s answer decide another\'s', () => {
    const prefs = [pref('safety_check', 'sms', true)]
    expect(prefEnabled(prefs, 'safety_check', 'sms')).toBe(true)
    expect(prefEnabled(prefs, 'safety_check', 'email')).toBe(true)   // still the default
  })

  it('does not let one notification\'s answer decide another\'s', () => {
    const prefs = [pref('other_thing', 'email', false)]
    expect(prefEnabled(prefs, 'safety_check', 'email')).toBe(true)
  })
})

describe('mayNotify', () => {
  it('refuses an unreachable member however the preference reads', () => {
    expect(mayNotify({ prefs: [], key: 'safety_check', channel: 'email', reachable: false }))
      .toBe(false)
    expect(mayNotify({
      prefs: [pref('safety_check', 'sms', true)],
      key: 'safety_check', channel: 'sms', reachable: false,
    })).toBe(false)
  })

  it('refuses a reachable member who has opted out', () => {
    expect(mayNotify({
      prefs: [pref('safety_check', 'email', false)],
      key: 'safety_check', channel: 'email', reachable: true,
    })).toBe(false)
  })

  it('sends where both halves agree', () => {
    expect(mayNotify({ prefs: [], key: 'safety_check', channel: 'email', reachable: true }))
      .toBe(true)
    expect(mayNotify({
      prefs: [pref('safety_check', 'sms', true)],
      key: 'safety_check', channel: 'sms', reachable: true,
    })).toBe(true)
  })
})
