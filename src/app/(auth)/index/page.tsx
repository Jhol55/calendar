'use client';

import { CreateInstanceForm } from '@/components/forms/create-instance/create-instance';
import { Typography } from '@/components/ui/typography';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { InstanceService } from '@/services/instance';
import { useUser } from '@/hooks/use-user';
import { InstanceCard } from '@/components/ui/instance-card/instance-card';
import { Button } from '@/components/ui/button';

export default function Index() {
  const [showCreateInstanceForm, setShowCreateInstanceForm] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useOutsideClick(ref, (event) => {
    if (buttonRef.current?.contains(event.target as Node)) return;
    setShowCreateInstanceForm(false);
  });

  useEffect(() => {
    if (showCreateInstanceForm) {
      document.body.style.overflow = 'hidden';
    } else {
      const timeout = setTimeout(() => {
        document.body.style.overflow = 'auto';
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [showCreateInstanceForm]);

  const [instances, setInstances] = useState([]);
  const { user } = useUser();

  useEffect(() => {
    if (!user?.id) return;

    const fetchInstances = async () => {
      InstanceService.getInstances(user?.id).then(({ data }) =>
        setInstances(data),
      );
    };

    fetchInstances();
  }, [user?.id]);

  return (
    <main className="relative flex items-center w-full max-w-screen h-screen">
      <section className="flex flex-col items-center justify-center h-full mx-auto w-full">
        <div className="flex items-center gap-4 w-2/3 mb-6">
          <Typography variant="h2">Minhas Instâncias</Typography>
          <Button
            className="w-fit"
            variant="gradient"
            ref={buttonRef}
            onClick={() => setShowCreateInstanceForm((prev) => !prev)}
          >
            Adicionar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-2/3 flex-wrap">
          {!!instances.length &&
            instances.map((instance, index) => (
              <InstanceCard key={index} instance={instance} />
            ))}
        </div>
      </section>

      <AnimatePresence>
        {showCreateInstanceForm && (
          <motion.div
            ref={ref}
            className="absolute top-0 right-0 w-full md:max-w-[500px]"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <CreateInstanceForm
              onSubmitSuccessful={() =>
                setTimeout(() => setShowCreateInstanceForm(false), 2000)
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
