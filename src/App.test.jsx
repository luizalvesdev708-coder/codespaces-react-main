import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Dotal login shell', () => {
  render(<App />);
  const title = screen.getByAltText(/Dotal consultoria/i);
  expect(title).toBeDefined();
});
