'use strict';

const React = require('react');

class Counter extends React.Component {
    static displayName = 'Counter';
    state = { count: this.props.initialCount };

    _increment = () => {
		this.setState({ count: this.state.count + 1 });
	};

    render() {
		return React.createElement(
			'span',
			{ onClick: this._increment },
			this.state.count
		);
	}
}

module.exports = Counter;

