'use client';

import React, { useEffect } from 'react';
import { Drawer } from 'vaul';
import { Listing, Application } from '../types';
import { ListingDetailPane } from './ListingDetailPane';

interface MobileDetailSheetProps {
  listing: Listing | null;
  application?: Application;
  isOpen: boolean;
  onClose: () => void;
  onSave: (listing: Listing) => void;
  onOpenPitch: (listing: Listing) => void;
}

export function MobileDetailSheet({
  listing,
  application,
  isOpen,
  onClose,
  onSave,
  onOpenPitch,
}: MobileDetailSheetProps) {
  // Predictive back gesture: push history state when drawer opens so Back gesture closes it
  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ drawer: true }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  if (!listing) return null;

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] flex flex-col rounded-t-[16px] bg-background-light dark:bg-background-dark border-t border-hairline-light dark:border-hairline-dark outline-none safe-bottom">
          {/* Grab handle */}
          <div className="p-3 flex justify-center shrink-0">
            <div className="w-12 h-1.5 rounded-full bg-hairline-light dark:bg-hairline-dark" />
          </div>

          <div className="overflow-y-auto px-4 pb-8 flex-1">
            <ListingDetailPane
              listing={listing}
              application={application}
              onSave={onSave}
              onOpenPitch={onOpenPitch}
              onClose={onClose}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

