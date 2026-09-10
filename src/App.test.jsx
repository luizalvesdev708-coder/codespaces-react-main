import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders CENSO DOTAL login shell', () => {
  render(<App />);
  const title = screen.getAllByText(/CENSO/i)[0];
  expect(title).toBeDefined();
});
