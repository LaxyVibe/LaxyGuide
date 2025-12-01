import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ViewTransitionLinkProps {
    to: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

const ViewTransitionLink: React.FC<ViewTransitionLinkProps> = ({ to, children, className, onClick }) => {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onClick) onClick();
        if ('startViewTransition' in document) {
            document.startViewTransition(() => {
                navigate(to);
            });
        } else {
            navigate(to);
        }
    };

    return (
        <a href={to} onClick={handleClick} className={className}>
            {children}
        </a>
    );
};

export default ViewTransitionLink;