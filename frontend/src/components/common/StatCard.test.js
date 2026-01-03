import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatCard } from './Card';
// Mock HeroIcon since it's passed as a component
const MockIcon = () => <svg data-testid="mock-icon" />;

describe('StatCard Component', () => {
    test('renders title and value', () => {
        render(<StatCard title="Total Sales" value="$1,000" />);
        expect(screen.getByText('Total Sales')).toBeInTheDocument();
        expect(screen.getByText('$1,000')).toBeInTheDocument();
    });

    test('renders icon when provided', () => {
        render(<StatCard title="Sales" value="100" icon={MockIcon} />);
        expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    test('renders positive trend correctly', () => {
        render(<StatCard title="Growth" value="10%" trend={5.5} />);
        const trendElement = screen.getByText('+5.5%');
        expect(trendElement).toBeInTheDocument();
        expect(trendElement).toHaveClass('text-green-600');
    });

    test('renders negative trend correctly', () => {
        render(<StatCard title="Loss" value="10%" trend={-2.5} />);
        const trendElement = screen.getByText('-2.5%');
        expect(trendElement).toBeInTheDocument();
        expect(trendElement).toHaveClass('text-red-600');
    });
});
