import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return <dialog ref={ref} className="drawer" aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="drawer-body">
      <div className="drawer-header"><h2 id={id}>{title}</h2><button type="button" className="icon-button" aria-label={'Close ' + title.toLowerCase()} onClick={onClose}><X aria-hidden="true" /></button></div>
      {open && children}
    </div>
  </dialog>
}
