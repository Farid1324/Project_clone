import type { ProductRequirements as Requirements, Requirement } from '../types/api'

function RequirementList({ title, items }: { title: string; items: Requirement[] }) {
  return <div className="requirements-panel"><h3>{title}</h3><dl>{items.map((item, index) => <div key={item.label + index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></div>
}

export function ProductRequirements({ requirements }: { requirements?: Requirements | null }) {
  const windows = requirements?.kind === 'pc'
  return <section className="product-info-section" aria-labelledby="requirements-heading">
    <h2 id="requirements-heading">{windows ? 'Windows system requirements' : 'Requirements and compatibility'}</h2>
    {!requirements?.minimum.length ? <p className="muted">Requirements have not been supplied for this listing. Check the platform and activation information before a real purchase.</p>
      : <><div className={'requirements-grid' + (!requirements.recommended.length ? ' requirements-single' : '')}>
        <RequirementList title={windows ? 'Minimum' : 'Activation requirements'} items={requirements.minimum} />
        {requirements.recommended.length > 0 && <RequirementList title="Recommended" items={requirements.recommended} />}
      </div>{requirements.notes.map((note, index) => <p className="requirements-note" key={index}>{note}</p>)}
        {requirements.source_url?.startsWith('https://store.steampowered.com/app/') && <a className="text-link" href={requirements.source_url} target="_blank" rel="noreferrer">Check current requirements on Steam <span className="sr-only">(opens a new tab)</span></a>}</>}
  </section>
}
