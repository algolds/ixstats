import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import { SuggestionsPanel } from '~/components/builders/SuggestionsPanel';

describe('SuggestionsPanel', () => {
  it('renders suggestions and triggers apply', () => {
    const onApply = jest.fn();
    render(
      <SuggestionsPanel
        suggestions={[{ id: '1', title: 'Test Suggestion', severity: 'info' }]}
        onApply={onApply}
      />
    );
    screen.getByText('Test Suggestion');
    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalled();
  });
});


