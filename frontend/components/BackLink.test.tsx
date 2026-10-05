import { render, screen } from '@testing-library/react';
import { BackLink } from './BackLink';

describe('BackLink', () => {
  it('renders a link to the given href with the default label', () => {
    render(<BackLink href="/groups" />);
    const link = screen.getByRole('link', { name: /back/i });
    expect(link).toHaveAttribute('href', '/groups');
  });

  it('renders a custom label when provided', () => {
    render(<BackLink href="/groups/1" label="Back to group" />);
    expect(screen.getByRole('link', { name: 'Back to group' })).toHaveAttribute('href', '/groups/1');
  });
});
