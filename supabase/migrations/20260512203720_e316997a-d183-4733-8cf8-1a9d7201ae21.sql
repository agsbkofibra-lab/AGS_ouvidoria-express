
CREATE TABLE public.ouvidoria_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_anonymous BOOLEAN NOT NULL DEFAULT true,
  name TEXT,
  role TEXT,
  message TEXT NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ouvidoria_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit ouvidoria messages"
  ON public.ouvidoria_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(message) BETWEEN 1 AND 5000
    AND (is_anonymous = true OR (name IS NOT NULL AND char_length(name) BETWEEN 1 AND 200))
  );

CREATE POLICY "Authenticated users can view messages"
  ON public.ouvidoria_messages
  FOR SELECT
  TO authenticated
  USING (true);
