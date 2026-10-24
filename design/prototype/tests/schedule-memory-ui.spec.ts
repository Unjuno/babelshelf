import {expect,test} from '@playwright/test';

async function navigate(page:any,destination:string){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:destination,exact:true}).click();
}

test('a schedule edited in Memory updates the Schedule view and notification delivery is clearly in-app',async({page})=>{
 await page.goto('/');
 await navigate(page,'Schedule');
 await expect(page.getByText('Runs while visible',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'New schedule'}).click();
 await page.getByRole('textbox',{name:'Schedule prompt'}).fill('Check the emergency kit');
 const tomorrow=await page.evaluate(()=>{const date=new Date();date.setDate(date.getDate()+1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;});
 await page.getByRole('textbox',{name:'Schedule date'}).fill(tomorrow);
 await page.getByRole('textbox',{name:'Schedule time'}).fill('09:00');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('button.schedule-detail',{hasText:'Check the emergency kit'})).toBeVisible();

 await navigate(page,'Memory');
 await page.getByRole('navigation',{name:'Memory path'}).getByRole('button',{name:'Memory',exact:true}).click();
 await page.getByRole('button',{name:'Open Schedule',exact:true}).click();
 await page.locator('.file-row').first().click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Markdown content'});
 const original=await editor.inputValue();
 expect(original).toContain('## Prompt\nCheck the emergency kit');
 await editor.fill(original.replace(/## Prompt\n[\s\S]*$/,'## Prompt\nUpdated emergency kit reminder'));
 await page.getByRole('button',{name:'Save',exact:true}).click();

 await navigate(page,'Schedule');
 await expect(page.locator('button.schedule-detail',{hasText:'Updated emergency kit reminder'})).toBeVisible();
 await navigate(page,'Notifications');
 await expect(page.getByText('In-app only',{exact:true})).toBeVisible();
});
