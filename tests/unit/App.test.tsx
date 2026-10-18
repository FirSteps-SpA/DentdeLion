import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../../src/app/App'

describe('App', () => {
  it('renders the app shell without crashing', () => {
    render(<App />)
    expect(screen.getByText('Dentdelion')).toBeInTheDocument()
  })
})
