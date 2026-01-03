import React from 'react';
import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card Component', () => {
    test('renders children correctly', () => {
        render(
            <Card>
                <p>Test Content</p>
            </Card>
        );
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('renders title when provided', () => {
        render(
            <Card title="Test Title">
                <p>Content</p>
            </Card>
        );
        expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    test('renders action element when provided', () => {
        render(
            <Card action={<button>Action</button>}>
                <p>Content</p>
            </Card>
        );
        expect(screen.getByText('Action')).toBeInTheDocument();
    });

    test('applies custom className', () => {
        const { container } = render(
            <Card className="custom-class">
                <p>Content</p>
            </Card>
        );
        // Note: Card renders a div with class 'card' and the custom class
        expect(container.firstChild).toHaveClass('custom-class');
    });
});
