// GPUAdapterInfo is a browser platform object, not structured-cloneable.
export function adapterSnapshot(adapter){
 const info={};for(const key of ['vendor','architecture','device','description'])info[key]=String(adapter.info?.[key]??'');
 return {available:true,info,features:[...adapter.features],limits:{maxBufferSize:adapter.limits.maxBufferSize,maxStorageBufferBindingSize:adapter.limits.maxStorageBufferBindingSize}};
}
