/* global localStorage */
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { ProjectConfig, ProjectStatus } from '../../shared/types'
import { api } from '../../src/api'
import { AppStateProvider, useAppState } from '../../src/state'

const a = { id: 'review-a', displayName: 'Review A' } as ProjectConfig
const b = { id: 'review-b', displayName: 'Review B' } as ProjectConfig
const status = (id: string) => ({ projectId: id }) as ProjectStatus

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(api, 'listProjects').mockResolvedValue([a, b])
})
afterEach(() => vi.restoreAllMocks())

it('R13: a late response from A must not overwrite selected project B', async () => {
  let resolveA!: (value: ProjectStatus) => void
  let resolveB!: (value: ProjectStatus) => void
  const pendingA = new Promise<ProjectStatus>((resolve) => { resolveA = resolve })
  const pendingB = new Promise<ProjectStatus>((resolve) => { resolveB = resolve })
  vi.spyOn(api, 'getStatus').mockImplementation((id) => id === a.id ? pendingA : pendingB)
  const { result } = renderHook(() => useAppState(), { wrapper: AppStateProvider })
  await waitFor(() => expect(api.getStatus).toHaveBeenCalledWith(a.id))
  act(() => result.current.setSelectedProjectId(b.id))
  await waitFor(() => expect(api.getStatus).toHaveBeenCalledWith(b.id))
  await act(async () => { resolveB(status(b.id)); await pendingB })
  expect(result.current.status?.projectId).toBe(b.id)
  await act(async () => { resolveA(status(a.id)); await pendingA })
  expect(result.current.selectedProjectId).toBe(b.id)
  expect(result.current.status?.projectId).toBe(b.id)
})

it('R14: saving the selected project must reload its cleared status', async () => {
  vi.spyOn(api, 'getStatus').mockResolvedValue(status(a.id))
  vi.spyOn(api, 'updateProject').mockResolvedValue(a)
  const { result } = renderHook(() => useAppState(), { wrapper: AppStateProvider })
  await waitFor(() => expect(result.current.status?.projectId).toBe(a.id))
  await act(async () => { await result.current.saveProject(a, a.id) })
  await waitFor(() => expect(result.current.status?.projectId).toBe(a.id))
})

it('saving configuration does not wait for external GitHub status', async () => {
  vi.spyOn(api, 'getStatus').mockResolvedValue(status(a.id))
  vi.spyOn(api, 'updateProject').mockResolvedValue(a)
  const { result } = renderHook(() => useAppState(), { wrapper: AppStateProvider })
  await waitFor(() => expect(result.current.status?.projectId).toBe(a.id))
  vi.mocked(api.getStatus).mockImplementation(() => new Promise(() => undefined))
  await act(async () => { expect(await result.current.saveProject(a, a.id)).toEqual(a) })
  expect(result.current.refreshing).toBe(true)
})
