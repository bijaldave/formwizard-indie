/**
 * Template loader for embedded PDF templates
 */

export async function loadEmbeddedTemplate(formType: '15g' | '15h'): Promise<File> {
  const templatePath = formType === '15g' 
    ? '/templates/15G_UPDATED-5.pdf'
    : '/templates/Form_15H-3.pdf';
    
  try {
    const response = await fetch(templatePath);
    
    if (!response.ok) {
      throw new Error(`Failed to load ${formType.toUpperCase()} template`);
    }
    
    const blob = await response.blob();
    const filename = formType === '15g' ? '15G_UPDATED-5.pdf' : 'Form_15H-3.pdf';
    
    return new File([blob], filename, { type: 'application/pdf' });
  } catch (error) {
    console.error('Template loading error:', error);
    throw new Error(`Could not load ${formType.toUpperCase()} template. Please check if the template files are available.`);
  }
}