import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../i18n'
import { ProjectEditor } from './ProjectEditor'

describe('new project flow', () => {
  it('submits a valid project with default safe references', async () => {
    const user = userEvent.setup(); const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ProjectEditor onSave={onSave} onCancel={() => undefined} />)
    await user.type(screen.getByLabelText('显示名称'), 'Second Project')
    await user.type(screen.getByLabelText('本地仓库路径'), 'D:\\projects\\second')
    await user.click(screen.getByRole('button', { name: '保存项目' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Second Project', localRepoPath: 'D:\\projects\\second', batchName: 'mvp-prd' }))
  })
})

