import {Component, type ReactNode} from 'react';

/** Keep navigation available if a deferred screen cannot be loaded. */
export class DeferredViewBoundary extends Component<{children:ReactNode;onClose:()=>void;closeLabel:string},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){
  if(this.state.failed)return <section role="alert"><p>Page unavailable · reload app</p><button type="button" className="quiet-button" onClick={this.props.onClose}>{this.props.closeLabel}</button></section>;
  return this.props.children;
 }
}
