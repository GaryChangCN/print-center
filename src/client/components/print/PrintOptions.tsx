import type { PrintOptions as PrintOptionsType } from '../../lib/types'
import { PAPER_SIZES, ORIENTATIONS, DUPLEX_OPTIONS, NUP_OPTIONS } from '../../lib/constants'

export function PrintOptions({
  options,
  onChange,
}: {
  options: PrintOptionsType
  onChange: (opts: PrintOptionsType) => void
}) {
  const update = <K extends keyof PrintOptionsType>(key: K, value: PrintOptionsType[K]) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-ink-700">打印设置</h3>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
      {/* 份数 */}
      <div>
        <label className="label">份数</label>
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary !px-3 !py-1.5"
            onClick={() => update('copies', Math.max(1, options.copies - 1))}
          >
            -
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={options.copies}
            onChange={(e) => update('copies', Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            className="input w-16 text-center"
          />
          <button
            className="btn-secondary !px-3 !py-1.5"
            onClick={() => update('copies', Math.min(99, options.copies + 1))}
          >
            +
          </button>
        </div>
      </div>

      {/* 纸张大小 */}
      <div>
        <label className="label">纸张大小</label>
        <select
          className="select"
          value={options.paperSize}
          onChange={(e) => update('paperSize', e.target.value as PrintOptionsType['paperSize'])}
        >
          {PAPER_SIZES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
      {/* 方向 */}
      <div>
        <label className="label">方向</label>
        <div className="flex gap-2">
          {ORIENTATIONS.map((o) => (
            <button
              key={o.value}
              className={`btn flex-1 ${options.orientation === o.value ? 'bg-accent text-white' : 'bg-paper-100 text-ink-600'}`}
              onClick={() => update('orientation', o.value as PrintOptionsType['orientation'])}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* 合并打印 */}
      <div>
        <label className="label">合并打印</label>
        <div className="flex gap-2">
          {NUP_OPTIONS.map((n) => (
            <button
              key={n.value}
              className={`btn flex-1 ${options.nup === n.value ? 'bg-accent text-white' : 'bg-paper-100 text-ink-600'}`}
              onClick={() => update('nup', n.value as PrintOptionsType['nup'])}
            >
              {n.label}
            </button>
          ))}
        </div>
      </div>

      {/* 页码范围 */}
      <div>
        <label className="label">页码范围</label>
        <input
          className="input"
          placeholder="全部页（或输入如 1-3,5）"
          value={options.pageRange}
          onChange={(e) => update('pageRange', e.target.value)}
        />
      </div>

      {/* 双面打印 */}
      <div>
        <label className="label">单/双面</label>
        <select
          className="select"
          value={options.duplex}
          onChange={(e) => update('duplex', e.target.value as PrintOptionsType['duplex'])}
        >
          {DUPLEX_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        {options.duplex !== 'off' && (
          <p className="text-xs text-amber-600 mt-1">
            * 本打印机需手动翻转纸张实现双面打印
          </p>
        )}
      </div>
      </div>
    </div>
  )
}
