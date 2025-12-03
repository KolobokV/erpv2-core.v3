
import React from 'react'
import type { Task } from '../types'

type Props = {
  tasks: Task[]
}

export default function TaskTable({ tasks }: Props) {
  const cols = Array.from(
    new Set(tasks.flatMap(t => Object.keys(t)))
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={i}>
              {cols.map(c => (
                <td key={c} style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
                  {String((t as any)[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
