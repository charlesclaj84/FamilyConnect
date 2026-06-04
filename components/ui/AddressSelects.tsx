'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { COUNTRIES, REGIONS, type Country } from '@/lib/regions'

interface Props {
  country: string
  state: string
  onCountryChange: (v: string) => void
  onStateChange: (v: string) => void
  countryId?: string
  stateId?: string
}

export function AddressSelects({ country, state, onCountryChange, onStateChange, countryId = 'country', stateId = 'state' }: Props) {
  const availableRegions = country && country in REGIONS ? REGIONS[country as Country] : []

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={countryId}>Country</Label>
        <Select
          id={countryId}
          value={country}
          onChange={e => { onCountryChange(e.target.value); onStateChange('') }}
        >
          <option value="">— Select country —</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={stateId}>State / Province</Label>
        {availableRegions.length > 0 ? (
          <Select id={stateId} value={state} onChange={e => onStateChange(e.target.value)}>
            <option value="">— Select state —</option>
            {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        ) : (
          <Input id={stateId} value={state} onChange={e => onStateChange(e.target.value)} placeholder="State / Province" />
        )}
      </div>
    </>
  )
}
