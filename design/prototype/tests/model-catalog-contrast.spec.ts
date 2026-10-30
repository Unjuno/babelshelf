import {expect,test} from '@playwright/test';

async function navigate(page:any,destination:string){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:destination==='Memory'?'BabelShelf':destination,exact:true}).click();
}

test('model catalog actions keep readable contrast in dark appearance',async({page})=>{
 await page.goto('/');
 await navigate(page,'Settings');
 await page.getByRole('button',{name:'Appearance',exact:true}).click();
 await page.getByRole('group',{name:'Theme'}).getByRole('button',{name:'Dark',exact:true}).click();
 await page.getByRole('button',{name:'Back to Settings'}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByText('More text options',{exact:true}).click();
 await page.getByRole('button',{name:'Browse text models',exact:true}).click();

 for(const label of ['Find on Hugging Face','Add a new GGUF text model']){
  const button=page.getByRole('button',{name:label,exact:true});
  await expect(button).toBeVisible();
  const contrast=await button.evaluate((element:Element)=>{
   const rgb=(value:string)=>{
    const channels=value.match(/[\d.]+/g)?.map(Number);
    if(!channels||channels.length<3)return null;
    return channels.slice(0,3).map(channel=>{
     const normalized=channel/255;
     return normalized<=0.04045?normalized/12.92:((normalized+0.055)/1.055)**2.4;
    });
   };
   const luminance=(value:number[])=>0.2126*value[0]+0.7152*value[1]+0.0722*value[2];
   const foreground=rgb(getComputedStyle(element).color);
   let background: number[]|null=null;
   for(let current:Element|null=element;current;current=current.parentElement){
    const color=getComputedStyle(current).backgroundColor;
    const channels=color.match(/[\d.]+/g)?.map(Number);
    if(channels&&(channels.length<4||channels[3]>=0.99)){
     background=rgb(color);
     if(background)break;
    }
   }
   if(!foreground||!background)return 0;
   const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
   return (values[0]+0.05)/(values[1]+0.05);
  });
  expect(contrast,`${label} contrast`).toBeGreaterThanOrEqual(4.5);
 }
});
