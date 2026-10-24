import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

describe('MarkdownRenderer component', () => {
  it('renders headings correctly', () => {
    const md = '# Main Header\n## Sub Header\n### Section Header';
    render(<MarkdownRenderer content={md} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Header');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sub Header');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Section Header');
  });

  it('renders bold, italic, and inline code formatting', () => {
    const md = 'This is **bold text**, this is *italic text*, and this is `code snippet`.';
    const { container } = render(<MarkdownRenderer content={md} />);

    const strong = container.querySelector('strong');
    expect(strong).toHaveTextContent('bold text');

    const em = container.querySelector('em');
    expect(em).toHaveTextContent('italic text');

    const code = container.querySelector('code');
    expect(code).toHaveTextContent('code snippet');
  });

  it('renders markdown tables with headers and rows properly', () => {
    const md = `
| Item | Detail | Observation |
|---|---|---|
| NCR No. | 084 | Transverse crack |
| Location | Pier 18 | Compliant UPV 3850 m/s |
`;
    const { container } = render(<MarkdownRenderer content={md} />);

    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();

    const headers = container.querySelectorAll('th');
    expect(headers).toHaveLength(3);
    expect(headers[0]).toHaveTextContent('Item');
    expect(headers[1]).toHaveTextContent('Detail');
    expect(headers[2]).toHaveTextContent('Observation');

    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(6);
    expect(cells[0]).toHaveTextContent('NCR No.');
    expect(cells[1]).toHaveTextContent('084');
    expect(cells[3]).toHaveTextContent('Location');
    expect(cells[4]).toHaveTextContent('Pier 18');
  });

  it('renders unordered and ordered lists', () => {
    const md = `
- Bullet item 1
- Bullet item 2

1. Ordered item 1
2. Ordered item 2
`;
    render(<MarkdownRenderer content={md} />);

    expect(screen.getByText('Bullet item 1')).toBeInTheDocument();
    expect(screen.getByText('Bullet item 2')).toBeInTheDocument();
    expect(screen.getByText('Ordered item 1')).toBeInTheDocument();
    expect(screen.getByText('Ordered item 2')).toBeInTheDocument();
  });

  it('renders citation tags and handles clicks', () => {
    const md = 'According to the QA report [DOC-1], the cantilever is sound.';
    render(<MarkdownRenderer content={md} />);

    const citationBadge = screen.getByText('DOC-1');
    expect(citationBadge).toBeInTheDocument();
    expect(citationBadge).toHaveClass('font-mono');
  });

  it('safely escapes HTML tags and prevents script injection', () => {
    const md = 'Testing security: <script>alert("xss")</script> <b>not bold html</b>';
    const { container } = render(<MarkdownRenderer content={md} />);

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/alert\("xss"\)/)).toBeInTheDocument();
  });
});
